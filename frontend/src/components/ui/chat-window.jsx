import { useRef, useState } from "react"
import { ArrowUpIcon, Folder, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageList } from "@/components/ui/message-list"
import { StatusBadge } from "@/components/ui/status-badge"

const COMMANDS = [
  {
    name: "/compact",
    description: "Summarize current chat context",
  },
]

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ChatWindow({ onToggleSidebar }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)
  const [compactProgress, setCompactProgress] = useState(0)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)

  const pendingBotMessageId = useRef(null)
  const abortControllerRef = useRef(null)

  async function startBotResponse(userMessage) {
    const isCompactCommand = userMessage.trim().toLowerCase() === "/compact"
    setIsGenerating(true)
    setCommandMenuOpen(false)

    if (isCompactCommand) {
      setIsCompacting(true)
      setCompactProgress(0)
    }

    const botMessageId = `msg_bot_${Date.now()}`
    pendingBotMessageId.current = botMessageId

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    if (!isCompactCommand) {
      setMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          role: "assistant",
          content: "Gândesc...",
          createdAt: formatTime(),
        },
      ])
    }

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

      if (!isCompactCommand) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, content: "" }
              : msg
          )
        )
      }

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

          if (data.type === "progress") {
            if (isCompactCommand) {
              setCompactProgress(Math.min(100, Number(data.progress) || 0))
            }
          }

          if (data.type === "token") {
            if (isCompactCommand) {
              continue
            }

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
            if (isCompactCommand) {
              setCompactProgress(100)
            }
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return

      console.error(err)

      if (!isCompactCommand) {
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
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        pendingBotMessageId.current = null
        abortControllerRef.current = null
        setIsGenerating(false)
        setIsCompacting(false)
      }
    }
  }

  function stopBotResponse() {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    pendingBotMessageId.current = null
    setIsGenerating(false)
    setIsCompacting(false)
  }

  function handleSend() {
    if (isGenerating) {
      stopBotResponse()
      return
    }

    if (!text.trim()) return

    const userMessage = text.trim()

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
    setCommandMenuOpen(false)

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

  function handleTextChange(nextValue) {
    setText(nextValue)
    setCommandMenuOpen(nextValue.startsWith("/"))
  }

  function applyCommand(commandName) {
    setText(commandName)
    setCommandMenuOpen(false)
  }

  const canSend = text.trim().length > 0

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <Header isGenerating={isGenerating} onToggleSidebar={onToggleSidebar} />

      <div className="min-h-0 flex-1">
        <MessageList messages={messages} />
      </div>

      <div className="border-t-[3px] border-black bg-white p-4">
        {isCompacting && (
          <div className="mb-3 border-[3px] border-black bg-[#fdf2f8] p-3 shadow-[4px_4px_0px_#000]">
            <div className="mb-2 flex items-center justify-between text-[0.65rem] font-black uppercase tracking-[0.12em] text-black">
              <span>Compacting context</span>
              <span>{compactProgress}%</span>
            </div>
            <div className="neo-progress-track">
              <div className="neo-progress-fill" style={{ width: `${compactProgress}%` }} />
            </div>
          </div>
        )}

        <div className="chat-input-area-wrapper">
          {commandMenuOpen && (
            <div className="command-menu">
              {COMMANDS.map((command) => (
                <button
                  key={command.name}
                  type="button"
                  className="command-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyCommand(command.name)
                  }}
                >
                  <span className="cmd-name">{command.name}</span>
                  <span className="cmd-desc">{command.description}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Textarea
              variant="neo"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
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