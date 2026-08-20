from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from ollama import Client
from werkzeug.utils import secure_filename

import json
import os

from rag import create_rag, search
from chats import load_chats, save_chats


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

client = Client(
    host=OLLAMA_HOST
)

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


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

    if not filename.lower().endswith(".txt"):

        return jsonify({
            "error": "Only .txt files are supported"
        }), 400

    filepath = os.path.join(
        UPLOAD_FOLDER,
        filename
    )

    try:

        file.save(filepath)

        create_rag()

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

        create_rag()

        return jsonify({
            "status": "ok"
        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


# ============================================================
# Chat
# ============================================================

@app.route("/chat", methods=["POST"])
def chat():

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


    # Search documents

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


    # Build prompt

    messages = [
        {
            "role": "system",
            "content": f"""
Answer the user's question using the provided documents.

DOCUMENTS:

{context}

Youu can also talk about things that are not in the documents, but you must always answer the user's question.
"""
        },
        *chats[chat_id]
    ]


    def generate():

        answer = ""

        try:

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
            "embedding_model": "nomic-embed-text"
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

    print("Building RAG...")

    try:
        create_rag()
    except Exception as e:
        print(
            f"RAG startup failed: {e}"
        )

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )