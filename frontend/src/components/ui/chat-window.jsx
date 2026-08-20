import { useRef, useState } from "react"
import { ArrowUpIcon, Folder, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageList } from "@/components/ui/message-list"
import { StatusBadge } from "@/components/ui/status-badge"

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// onToggleSidebar lets the header's FILES button open/close the
// global file sidebar from anywhere, regardless of its current state.
export function ChatWindow({ onToggleSidebar }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const pendingBotMessageId = useRef(null)
  const abortControllerRef = useRef(null)

  async function startBotResponse(userMessage) {
    setIsGenerating(true)

    const botMessageId = `msg_bot_${Date.now()}`
    pendingBotMessageId.current = botMessageId

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setMessages((prev) => [
      ...prev,
      {
        id: botMessageId,
        role: "assistant",
        content: "Gândesc...",
        createdAt: formatTime(),
      },
    ])

    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
        body: JSON.stringify({
          message: userMessage,
        }),
      })

      if (!res.ok) {
        throw new Error(`Backend a returnat ${res.status}`)
      }

      if (!res.body) {
        throw new Error("Răspunsul nu conține un stream")
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, content: "" }
            : msg
        )
      )

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split("\n\n")
        buffer = events.pop() || ""

        for (const event of events) {
          if (!event.startsWith("data: ")) continue

          const json = event.slice("data: ".length)
          const data = JSON.parse(json)

          if (data.type === "token") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      content: msg.content + data.content,
                    }
                  : msg
              )
            )
          }

          if (data.type === "done") {
            console.log("Stream finalizat")
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return

      console.error(err)

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                content: `❌ Eroare: ${err.message}`,
              }
            : msg
        )
      )
    } finally {
      if (abortControllerRef.current === abortController) {
        pendingBotMessageId.current = null
        abortControllerRef.current = null
        setIsGenerating(false)
      }
    }
  }

  function stopBotResponse() {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    pendingBotMessageId.current = null
    setIsGenerating(false)
  }

  function handleSend() {
    if (isGenerating) {
      stopBotResponse()
      return
    }

    if (!text.trim()) return

    const userMessage = text

    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        role: "user",
        content: userMessage,
        createdAt: formatTime(),
      },
    ])

    setText("")

    startBotResponse(userMessage)
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()

      if (!isGenerating) {
        handleSend()
      }
    }
  }

  const canSend = text.trim().length > 0

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <Header isGenerating={isGenerating} onToggleSidebar={onToggleSidebar} />

      <div className="min-h-0 flex-1">
        <MessageList messages={messages} />
      </div>

      <div className="flex gap-3 border-t-[3px] border-black bg-white p-4">
        <Textarea
          variant="neo"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          placeholder={
            isGenerating ? "Botul răspunde..." : "Type command or message..."
          }
          className="min-h-[46px] max-h-[120px]"
          rows={1}
        />

        {isGenerating ? (
          <Button
            variant="neo-pink"
            onClick={stopBotResponse}
            className="shrink-0 animate-pulse gap-2 px-5"
          >
            <Square className="size-3.5 fill-current" />
            STOP
          </Button>
        ) : (
          <Button
            variant="neo-pink"
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 gap-2 px-5"
          >
            SEND
            <ArrowUpIcon className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function Header({ isGenerating, onToggleSidebar }) {
  return (
    <div className="flex items-center justify-between border-b-[3px] border-black bg-[var(--neo-cyan)] p-2 px-3">
      <div className="flex items-center gap-3">
        <Button variant="neo-yellow" size="sm" onClick={onToggleSidebar} className="gap-1.5">
          <Folder className="size-3.5" />
          FILES
        </Button>

        <div>
          <h1 className="text-sm font-black uppercase tracking-wide text-black">
            Contexta
          </h1>
          <p className="text-[0.65rem] font-bold text-black/60">
            Instant answers from your documents
          </p>
        </div>
      </div>

      <StatusBadge isGenerating={isGenerating} />
    </div>
  )
}