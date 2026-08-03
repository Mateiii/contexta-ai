from flask import Flask, request, jsonify
import ollama


app = Flask(__name__)


@app.route("/chat", methods=["POST"])
def chat():

    data = request.json

    user_message = data["message"]

    response = ollama.chat(
        model="llama3.2",
        messages=[
            {
                "role": "user",
                "content": user_message
            }
        ]
    )

    answer = response["message"]["content"]

    return jsonify({
        "answer": answer
    })


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000
    )