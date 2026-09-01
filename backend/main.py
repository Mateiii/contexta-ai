from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from ollama import Client
from werkzeug.utils import secure_filename

import json
import os
import threading

from rag import create_rag, remove_file_from_rag, search
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

MODEL = "gemma3:12b"

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

# A file changed while the current RAG snapshot was being built.  Keeping this
# flag means rapid uploads/deletes are coalesced, but never silently skipped.
rag_rebuild_pending = False

# There is at most one rebuild worker.  It performs another pass whenever a
# file operation arrives during the current pass.
rag_rebuild_running = False


def rebuild_rag():
    """
    Rebuild the RAG in the background.

    Build until no file changes occurred during a build. While rebuilding,
    rag_busy is True so chat requests are rejected by the backend.
    """

    global rag_busy, rag_rebuild_pending, rag_rebuild_running

    while True:
        # This build accounts for every change requested before this point.
        with rag_lock:
            rag_rebuild_pending = False

        try:
            print("RAG rebuild started.")
            with rag_data_lock:
                create_rag()
            print("RAG rebuild finished.")

        except Exception as e:
            print(f"RAG rebuild failed: {e}")

        with rag_lock:
            if not rag_rebuild_pending:
                rag_busy = False
                rag_rebuild_running = False
                return

        print("RAG changed during rebuild; rebuilding again.")


def start_rag_rebuild():
    """
    Request a background RAG rebuild.

    A request made during an active rebuild is recorded and causes one final
    rebuild, so the generated index always catches up with rapid file changes.
    """

    global rag_busy, rag_rebuild_pending, rag_rebuild_running

    with rag_lock:
        rag_rebuild_pending = True

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

        # Rebuild RAG in the background.
        start_rag_rebuild()

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
                model=MODEL,
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

        if MODEL not in model_names:
            missing.append(MODEL)

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
            "model": MODEL,
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
