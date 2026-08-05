import requests
import json


response = requests.post(
    "http://localhost:5000/chat",
    json={
        "message": "Make me a pancake recipe"
    },
    stream=True
)


for line in response.iter_lines():

    if line:

        text = line.decode("utf-8")


        if text.startswith("data: "):

            json_data = text[6:]

            event = json.loads(json_data)


            if event["type"] == "token":

                print(
                    event["content"],
                    end="",
                    flush=True
                )


            elif event["type"] == "done":

                print("\n\nFinished")