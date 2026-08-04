from flask import Flask, request, jsonify
from ollama import Client
import os

app = Flask(__name__)

client = Client(
    host=os.getenv("OLLAMA_HOST", "http://ollama:11434")
)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data["message"]

    response = client.chat(
        model="llama3.2",
        messages=[
            {
                "role": "user",
                "content": user_message
            }
        ]
    )

    return jsonify({
        "answer": response["message"]["content"]
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)