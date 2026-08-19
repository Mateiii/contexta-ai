from flask import Flask, Response, request
from flask_cors import CORS
from ollama import Client
import json
import os

app = Flask(__name__)

CORS(app, origins="http://localhost:5173")


client = Client(
    host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
)


@app.route("/chat", methods=["POST"])
def chat():

    data = request.json

    user_message = data["message"]


    def generate():

        stream = client.chat(
            model="gemma3:12b",
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


    return Response(
        generate(),
        mimetype="text/event-stream"
    )

@app.route("/health", methods=["GET"])
def health():
    try:
        models = client.list()

        model_names = [
            model.model
            for model in models.models
        ]

        if "gemma3:12b" not in model_names:
            return {
                "status": "error",
                "flask": "ok",
                "ollama": "ok",
                "model": "gemma3:12b not found"
            }, 503

        return {
            "status": "ok",
            "flask": "ok",
            "ollama": "ok",
            "model": "gemma3:12b"
        }, 200

    except Exception as e:
        return {
            "status": "error",
            "flask": "ok",
            "ollama": "error",
            "error": str(e)
        }, 503

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000
    )