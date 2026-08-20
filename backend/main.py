from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from ollama import Client
from werkzeug.utils import secure_filename

import json
import os


# ============================================================
# App
# ============================================================

app = Flask(__name__)


# ============================================================
# CORS
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


# ============================================================
# Ollama configuration
# ============================================================

OLLAMA_HOST = os.getenv(
    "OLLAMA_HOST",
    "http://localhost:11434"
)

MODEL = "gemma3:12b"

client = Client(
    host=OLLAMA_HOST
)


# ============================================================
# File upload configuration
# ============================================================

UPLOAD_FOLDER = "uploads"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


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

    def generate():

        try:

            stream = client.chat(
                model=MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": user_message
                    }
                ],
                stream=True
            )

            for chunk in stream:

                token = chunk["message"]["content"]

                if token:

                    event = {
                        "type": "token",
                        "content": token
                    }

                    yield (
                        "data: "
                        + json.dumps(event)
                        + "\n\n"
                    )

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
            "Connection": "keep-alive",
        }
    )


# ============================================================
# File upload
# ============================================================

@app.route("/upload", methods=["GET"])
def list_files():

    files = []

    for filename in os.listdir(UPLOAD_FOLDER):

        filepath = os.path.join(
            UPLOAD_FOLDER,
            filename
        )

        if os.path.isfile(filepath):

            files.append({
                "id": filename,
                "name": filename,
                "size": os.path.getsize(filepath)
            })

    return jsonify(files), 200


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

    filename = secure_filename(file.filename)

    if not filename:

        return jsonify({
            "error": "Invalid filename"
        }), 400

    filepath = os.path.join(
        app.config["UPLOAD_FOLDER"],
        filename
    )

    try:

        file.save(filepath)

        return jsonify({
            "status": "ok",
            "filename": filename
        }), 200

    except OSError as e:

        return jsonify({
            "error": str(e)
        }), 500


# ============================================================
# File delete
# ============================================================

@app.route(
    "/upload/<filename>",
    methods=["DELETE", "OPTIONS"]
)
def delete_file(filename):

    # --------------------------------------------------------
    # Handle CORS preflight
    # --------------------------------------------------------

    if request.method == "OPTIONS":
        return "", 204

    # --------------------------------------------------------
    # Sanitize filename
    # --------------------------------------------------------

    filename = secure_filename(filename)

    if not filename:
        return jsonify({
            "error": "Invalid filename"
        }), 400

    # --------------------------------------------------------
    # Build file path
    # --------------------------------------------------------

    filepath = os.path.join(
        app.config["UPLOAD_FOLDER"],
        filename
    )

    # --------------------------------------------------------
    # Check file exists
    # --------------------------------------------------------

    if not os.path.isfile(filepath):

        return jsonify({
            "error": "File not found",
            "filename": filename
        }), 404

    # --------------------------------------------------------
    # Delete file
    # --------------------------------------------------------

    try:

        os.remove(filepath)

        return jsonify({
            "status": "ok",
            "filename": filename
        }), 200

    except OSError as e:

        return jsonify({
            "error": str(e)
        }), 500


# ============================================================
# Health check
# ============================================================

@app.route("/health", methods=["GET"])
def health():

    try:

        models = client.list()

        model_names = [
            model.model
            for model in models.models
        ]

        if MODEL not in model_names:

            return jsonify({
                "status": "error",
                "flask": "ok",
                "ollama": "ok",
                "model": f"{MODEL} not found",
                "available_models": model_names
            }), 503

        return jsonify({
            "status": "ok",
            "flask": "ok",
            "ollama": "ok",
            "model": MODEL,
            "available_models": model_names
        }), 200

    except Exception as e:

        return jsonify({
            "status": "error",
            "flask": "ok",
            "ollama": "error",
            "error": str(e)
        }), 503


# ============================================================
# Run
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )