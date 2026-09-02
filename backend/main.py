from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from ollama import Client
from werkzeug.utils import secure_filename

import json
import os
import threading

from rag import index_file, remove_file_from_rag, search
from chats import load_chats, save_chats, reset_chats


app = Flask(__name__)


# ============================================================
# Configuration
# ============================================================

CORS(
    app,
    resources={
        r"/*": {
            "origins": ["http://localhost:5173"]
        }
    },
    methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


OLLAMA_HOST = os.getenv(
    "OLLAMA_HOST",
    "http://localhost:11434"
)

AVAILABLE_MODELS = tuple(
    model.strip()
    for model in os.getenv(
        "OLLAMA_MODELS",
        "gemma3:12b,llama3.2:latest"
    ).split(",")
    if model.strip()
)
DEFAULT_MODEL = os.getenv(
    "OLLAMA_MODEL",
    AVAILABLE_MODELS[0]
)

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".md", ".json", ".csv"}

client = Client(
    host=OLLAMA_HOST
)

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


# ============================================================
# RAG State
# ============================================================

# Protects the rebuild state below.
rag_lock = threading.Lock()

# Prevent simultaneous reads/writes of the persisted RAG index. In particular,
# a fast delete must not race with a background upload rebuild.
rag_data_lock = threading.Lock()

# True while the RAG is being rebuilt.
rag_busy = False

# Files waiting to be indexed. This lets rapid uploads queue safely without
# re-embedding documents that are already in the index.
rag_rebuild_pending_files = set()

# There is at most one rebuild worker.  It performs another pass whenever a
# file operation arrives during the current pass.
rag_rebuild_running = False


def rebuild_rag():
    """
    Incrementally update the RAG in the background.

    Process until no uploads arrived during an update. While rebuilding,
    rag_busy is True so chat requests are rejected by the backend.
    """

    global rag_busy, rag_rebuild_pending_files, rag_rebuild_running

    while True:
        with rag_lock:
            pending_files = rag_rebuild_pending_files
            rag_rebuild_pending_files = set()

        print(f"RAG update started for: {', '.join(sorted(pending_files))}")

        for filename in pending_files:
            try:
                with rag_data_lock:
                    index_file(filename)

            except Exception as e:
                print(f"RAG update failed for {filename}: {e}")

        print("RAG update finished.")

        with rag_lock:
            if not rag_rebuild_pending_files:
                rag_busy = False
                rag_rebuild_running = False
                return

        print("More files arrived during the RAG update.")


def start_rag_rebuild(filename):
    """
    Queue one uploaded file for background indexing.

    A file uploaded during an active update is processed in the next pass,
    without rebuilding embeddings for unrelated documents.
    """

    global rag_busy, rag_rebuild_pending_files, rag_rebuild_running

    with rag_lock:
        rag_rebuild_pending_files.add(filename)

        if rag_rebuild_running:
            return

        rag_busy = True
        rag_rebuild_running = True

    threading.Thread(target=rebuild_rag, daemon=True).start()


def is_rag_busy():
    """
    Safely check whether RAG is currently rebuilding.
    """

    with rag_lock:
        return rag_busy


# ============================================================
# Files
# ============================================================

@app.route("/upload", methods=["GET"])
def list_files():

    files = []

    for filename in os.listdir(
        UPLOAD_FOLDER
    ):

        filepath = os.path.join(
            UPLOAD_FOLDER,
            filename
        )

        if os.path.isfile(filepath):

            files.append({
                "id": filename,
                "name": filename,
                "size": os.path.getsize(
                    filepath
                )
            })

    return jsonify(files)


@app.route("/upload", methods=["POST"])
def upload():

    if "file" not in request.files:

        return jsonify({
            "error": "No file provided"
        }), 400

    file = request.files["file"]

    if file.filename == "":

        return jsonify({
            "error": "No file selected"
        }), 400

    filename = secure_filename(
        file.filename
    )

    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:

        return jsonify({
            "error": (
                "Unsupported file type. "
                f"Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        }), 400

    filepath = os.path.join(
        UPLOAD_FOLDER,
        filename
    )

    try:

        file.save(filepath)

        # Index only this file in the background.
        start_rag_rebuild(filename)

        return jsonify({
            "status": "ok",
            "filename": filename
        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


@app.route(
    "/upload/<filename>",
    methods=["DELETE", "OPTIONS"]
)
def delete_file(filename):

    if request.method == "OPTIONS":
        return "", 204

    filename = secure_filename(
        filename
    )

    filepath = os.path.join(
        UPLOAD_FOLDER,
        filename
    )

    if not os.path.isfile(filepath):

        return jsonify({
            "error": "File not found"
        }), 404

    try:

        os.remove(filepath)

        # Removing chunks for one file is immediate and avoids re-embedding
        # every remaining document. The index lock keeps this safe if an
        # upload-triggered rebuild is already in progress.
        with rag_data_lock:
            remove_file_from_rag(filename)

        return jsonify({
            "status": "ok"
        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


# ============================================================
# RAG Status
# ============================================================

@app.route("/rag/status", methods=["GET"])
def rag_status():

    return jsonify({
        "busy": is_rag_busy()
    })


# ============================================================
# Chat
# ============================================================

@app.route("/chat", methods=["POST"])
def chat():

    # Never allow chat while RAG is rebuilding.
    if is_rag_busy():

        return jsonify({
            "error": "Documents are currently being updated. Please wait."
        }), 409

    data = request.get_json()

    if not data or not data.get("message"):

        return jsonify({
            "error": "Message is required"
        }), 400

    user_message = data["message"]

    model = data.get("model", DEFAULT_MODEL)

    if model not in AVAILABLE_MODELS:

        return jsonify({
            "error": "Selected model is not available"
        }), 400

    chat_id = data.get(
        "chat_id",
        "default"
    )

    chats = load_chats()

    chats.setdefault(
        chat_id,
        []
    )

    chats[chat_id].append({
        "role": "user",
        "content": user_message
    })


    # ========================================================
    # Search documents
    # ========================================================

    # RAG could theoretically start immediately after the
    # check above, so we check again before searching.
    if is_rag_busy():

        return jsonify({
            "error": "Documents are currently being updated. Please wait."
        }), 409

    relevant_chunks = search(
        user_message,
        count=3
    )

    context = ""

    for chunk in relevant_chunks:

        context += (
            f"\n--- {chunk['file']} ---\n"
            f"{chunk['text']}\n"
        )


    # ========================================================
    # Build prompt
    # ========================================================

    messages = [
        {
            "role": "system",
            "content": f"""
Answer the user's question using the provided documents.

DOCUMENTS:

{context}

You can also talk about things that are not in the documents, but you must always answer the user's question.
"""
        },
        *chats[chat_id]
    ]


    # ========================================================
    # Stream response
    # ========================================================

    def generate():

        answer = ""

        try:

            # Check one more time before contacting Ollama.
            if is_rag_busy():

                yield (
                    "data: "
                    + json.dumps({
                        "type": "error",
                        "content": (
                            "Documents are currently being updated. "
                            "Please wait."
                        )
                    })
                    + "\n\n"
                )

                return

            stream = client.chat(
                model=model,
                messages=messages,
                stream=True
            )

            for chunk in stream:

                token = chunk[
                    "message"
                ]["content"]

                if token:

                    answer += token

                    yield (
                        "data: "
                        + json.dumps({
                            "type": "token",
                            "content": token
                        })
                        + "\n\n"
                    )


            chats[chat_id].append({
                "role": "assistant",
                "content": answer
            })

            save_chats(chats)


            yield (
                "data: "
                + json.dumps({
                    "type": "done"
                })
                + "\n\n"
            )


        except Exception as e:

            print(
                f"Chat error: {e}"
            )

            yield (
                "data: "
                + json.dumps({
                    "type": "error",
                    "content": str(e)
                })
                + "\n\n"
            )


    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )


# ============================================================
# Health
# ============================================================

@app.route("/health", methods=["GET"])
def health():

    try:

        models = client.list()

        model_names = [
            model.model
            for model in models.models
        ]

        missing = []

        missing.extend(
            model
            for model in AVAILABLE_MODELS
            if model not in model_names
        )

        if not any(
            model.startswith("nomic-embed-text")
            for model in model_names
        ):
            missing.append("nomic-embed-text")

        if missing:

            return jsonify({
                "status": "error",
                "missing_models": missing,
                "available_models": model_names
            }), 503

        return jsonify({
            "status": "ok",
            "models": list(AVAILABLE_MODELS),
            "default_model": DEFAULT_MODEL,
            "embedding_model": "nomic-embed-text",
            "rag_busy": is_rag_busy()
        })


    except Exception as e:

        return jsonify({
            "status": "error",
            "error": str(e)
        }), 503


# ============================================================
# Startup
# ============================================================

if __name__ == "__main__":

    print("Resetting chats...")

    try:

        reset_chats()

    except Exception as e:

        print(
            f"Chat reset failed: {e}"
        )


    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
