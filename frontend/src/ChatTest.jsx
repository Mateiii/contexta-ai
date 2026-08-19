import { useState } from "react"

export default function ChatTest() {
  const [input, setInput] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function sendMessage() {
    if (!input.trim() || loading) {
      return
    }

    setResponse("")
    setError("")
    setLoading(true)

    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
        }),
      })

      if (!res.ok) {
        throw new Error(`Backend returned ${res.status}`)
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

        buffer += decoder.decode(value, {
          stream: true,
        })

        const events = buffer.split("\n\n")

        buffer = events.pop() || ""

        for (const event of events) {
          if (!event.startsWith("data: ")) {
            continue
          }

          const json = event.slice("data: ".length)
          const data = JSON.parse(json)

          if (data.type === "token") {
            setResponse((current) => current + data.content)
          }

          if (data.type === "done") {
            console.log("Stream finished")
          }
        }
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: "700px", margin: "50px auto", padding: "20px" }}>
      <h1>Chat Streaming Test</h1>

      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Ask something..."
        rows={4}
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      />

      <button
        onClick={sendMessage}
        disabled={loading || !input.trim()}
        style={{
          marginTop: "10px",
          padding: "10px 20px",
        }}
      >
        {loading ? "Generating..." : "Send"}
      </button>

      {error && (
        <p style={{ color: "red" }}>
          Error: {error}
        </p>
      )}

      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          minHeight: "100px",
          whiteSpace: "pre-wrap",
        }}
      >
        {response || "Response will appear here..."}
      </div>
    </div>
  )
}