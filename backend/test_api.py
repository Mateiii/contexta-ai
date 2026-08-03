import requests

message = input("Enter your message for the model api request:")

url = "http://localhost:5000/chat"

data = {
    "message": message
}

response = requests.post(
    url,
    json=data
)

result = response.json()

print(result["answer"])
