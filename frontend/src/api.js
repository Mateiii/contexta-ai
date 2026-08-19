// src/api.js
export async function sendChatMessage({ message, onToken }) {
  const res = await fetch("http://localhost:5000/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.message || `Backend returned ${res.status}`)
  }

  if (!res.body) {
    throw new Error("Response does not contain a stream")
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() || ""

    for (const event of events) {
      if (!event.startsWith("data: ")) {
        continue
      }

      const jsonStr = event.slice("data: ".length)
      const data = JSON.parse(jsonStr)

      if (data.type === "token") {
        onToken(data.content)
      }

      if (data.type === "done") {
        console.log("Stream finished")
      }
    }
  }
}