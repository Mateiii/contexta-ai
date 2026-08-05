from flask import Flask, Response, request
from ollama import Client
import json
import os


app = Flask(__name__)


client = Client(
    host=os.getenv("OLLAMA_HOST", "http://localhost:11434")
)


@app.route("/chat", methods=["POST"])
def chat():

    data = request.json

    user_message = data["message"]


    def generate():

        stream = client.chat(
            model="llama3.2",
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

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000
    )