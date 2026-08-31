from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from ollama import Client
from werkzeug.utils import secure_filename

import json
import os

from rag import create_rag, is_supported_file

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/*": {"origins": ["http://localhost:5173"]}
    },
    methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "llama3.2")
BASE_DIR = os.path.dirname(__file__)
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
DATA_DIR = os.path.join(BASE_DIR, "data")
CHATS_FILE = os.path.join(DATA_DIR, "chats.json")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

client = Client(host=OLLAMA_HOST, timeout=5)


def load_chats():
    if os.path.exists(CHATS_FILE):
        with open(CHATS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_chats(chats):
    with open(CHATS_FILE, "w", encoding="utf-8") as f:
        json.dump(chats, f, indent=4)


@app.route("/upload", methods=["GET"])
def list_files():
    files = []
    for filename in sorted(os.listdir(UPLOAD_FOLDER)):
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.isfile(filepath):
            files.append({
                "id": filename,
                "name": filename,
                "size": os.path.getsize(filepath),
            })
    return jsonify(files)


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    uploaded = request.files["file"]
    if not uploaded or uploaded.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(uploaded.filename)
    if not filename:
        return jsonify({"error": "Invalid filename"}), 400

    if not is_supported_file(filename):
        return jsonify({"error": "Unsupported file type. Upload a text document, PDF, or DOCX file."}), 400

    destination = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(destination):
        stem, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(os.path.join(UPLOAD_FOLDER, f"{stem}_{counter}{ext}")):
            counter += 1
        filename = f"{stem}_{counter}{ext}"
        destination = os.path.join(UPLOAD_FOLDER, filename)

    try:
        uploaded.save(destination)
        create_rag()
        return jsonify({
            "status": "ok",
            "filename": filename,
            "size": os.path.getsize(destination),
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/upload/<path:filename>", methods=["DELETE", "OPTIONS"])
def delete_file(filename):
    if request.method == "OPTIONS":
        return "", 204

    safe_name = secure_filename(filename)
    filepath = os.path.join(UPLOAD_FOLDER, safe_name)

    if not os.path.isfile(filepath):
        return jsonify({"error": "File not found"}), 404

    try:
        os.remove(filepath)
        create_rag()
        return jsonify({"status": "ok"})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    chat_id = data.get("chat_id", "default")

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    chats = load_chats()
    if chat_id not in chats:
        chats[chat_id] = []

    if user_message.lower() == "/compact":
        history = chats.get(chat_id, [])

        if not history:
            def empty_gen():
                yield "data: " + json.dumps({"type": "token", "content": "No history to compact."}) + "\n\n"
                yield "data: " + json.dumps({"type": "done"}) + "\n\n"

            return Response(empty_gen(), mimetype="text/event-stream")

        history_text = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history)
        summary_prompt = (
            "Summarize the following conversation in a few concise bullet points. "
            "Focus on key facts, user preferences, and important context.\n\n"
            f"{history_text}"
        )

        def generate_compact():
            summary_text = ""
            try:
                stream = client.chat(
                    model=MODEL_NAME,
                    messages=[{"role": "user", "content": summary_prompt}],
                    stream=True,
                )

                for chunk in stream:
                    token = chunk["message"]["content"]
                    if token:
                        summary_text += token
                        progress = min(99, max(5, int((len(summary_text) / max(len(history_text), 1)) * 100)))
                        yield "data: " + json.dumps({"type": "progress", "progress": progress}) + "\n\n"

                chats[chat_id] = [{"role": "system", "content": f"Summary of previous chat context:\n{summary_text}"}]
                save_chats(chats)
                yield "data: " + json.dumps({"type": "progress", "progress": 100}) + "\n\n"
                yield "data: " + json.dumps({"type": "done"}) + "\n\n"
            except Exception as exc:
                yield "data: " + json.dumps({"type": "error", "content": str(exc)}) + "\n\n"

        return Response(generate_compact(), mimetype="text/event-stream")

    chats[chat_id].append({"role": "user", "content": user_message})

    def generate_chat():
        reply = ""
        try:
            stream = client.chat(
                model=MODEL_NAME,
                messages=chats[chat_id],
                stream=True,
            )

            for chunk in stream:
                token = chunk["message"]["content"]
                if token:
                    reply += token
                    yield "data: " + json.dumps({"type": "token", "content": token}) + "\n\n"

            chats[chat_id].append({"role": "assistant", "content": reply})
            save_chats(chats)
            yield "data: " + json.dumps({"type": "done"}) + "\n\n"
        except Exception as exc:
            yield "data: " + json.dumps({"type": "error", "content": str(exc)}) + "\n\n"

    return Response(generate_chat(), mimetype="text/event-stream")


@app.route("/health", methods=["GET"])
def health():
    try:
        models = client.list()
        model_names = [model.model for model in models.models]
        if not any(MODEL_NAME in name for name in model_names):
            return jsonify({"status": "error", "flask": "ok", "ollama": "ok", "model": f"{MODEL_NAME} not found"}), 503
        return jsonify({"status": "ok", "flask": "ok", "ollama": "ok", "model": MODEL_NAME})
    except Exception as exc:
        return jsonify({"status": "error", "flask": "ok", "ollama": "error", "error": str(exc)}), 503


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
