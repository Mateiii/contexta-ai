import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { sendChatMessage } from "./api"

export default function ChatTest() {
  const [input, setInput] = useState("")
  const [response, setResponse] = useState("")

  // Configurarea mutației
  const chatMutation = useMutation({
    mutationFn: ({ message }) =>
      sendChatMessage({
        message,
        onToken: (token) => {
          // Concatenează fiecare token primit în starea locală
          setResponse((current) => current + token)
        },
      }),
  })

  function sendMessage() {
    if (!input.trim() || chatMutation.isPending) {
      return
    }

    setResponse("")
    
    // Apelarea mutației
    chatMutation.mutate({ message: input })
  }

  return (
    <div style={{ maxWidth: "700px", margin: "50px auto", padding: "20px" }}>
      <h1>Chat Streaming Test (React Query)</h1>

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
        disabled={chatMutation.isPending || !input.trim()}
        style={{
          marginTop: "10px",
          padding: "10px 20px",
        }}
      >
        {chatMutation.isPending ? "Generating..." : "Send"}
      </button>

      {/* Afișarea erorilor direct din starea furnizată de useMutation */}
      {chatMutation.isError && (
        <p style={{ color: "red" }}>
          Error: {chatMutation.error.message}
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