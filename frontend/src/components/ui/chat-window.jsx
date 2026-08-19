import { useRef, useState } from "react"
import { ArrowUpIcon, FileText, Paperclip, Sparkles, Square, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageList } from "@/components/ui/message-list"
import { StatusBadge } from "@/components/ui/status-badge"

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ChatWindow() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [attachments, setAttachments] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Ref pentru mesajul bot actual în curs de stream
  const pendingBotMessageId = useRef(null)
  const abortControllerRef = useRef(null)
  const responseTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)

  // ---------- attachments ----------

  function addFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return

    const newAttachments = files.map((file) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }))

    setAttachments((prev) => [...prev, ...newAttachments])
  }

  function removeAttachment(id) {
    setAttachments((prev) => prev.filter((file) => file.id !== id))
  }

  // ---------- real backend communication ----------
  // Fetches from backend at http://localhost:5000/chat and streams the response

  async function startBotResponse(userMessage) {
    setIsGenerating(true)

    const botMessageId = `msg_bot_${Date.now()}`
    pendingBotMessageId.current = botMessageId
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Add initial bot message with "Thinking..."
    setMessages((prev) => [
      ...prev,
      { id: botMessageId, role: "assistant", content: "Gândesc...", createdAt: formatTime() },
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

      // Clear the "Thinking..." message and start streaming
      setMessages((prev) =>
        prev.map((msg) => (msg.id === botMessageId ? { ...msg, content: "" } : msg))
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
                  ? { ...msg, content: msg.content + data.content }
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
            ? { ...msg, content: `❌ Eroare: ${err.message}` }
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
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current)
      responseTimeoutRef.current = null
    }

    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    pendingBotMessageId.current = null
    setIsGenerating(false)
  }

  // ---------- send ----------

  function handleSend() {
    if (isGenerating) {
      stopBotResponse()
      return
    }
    if (!text.trim() && attachments.length === 0) return

    const userMessage = text
    setMessages((prev) => [
      ...prev,
      { id: `msg_${Date.now()}`, role: "user", content: userMessage, attachments, createdAt: formatTime() },
    ])
    setText("")
    setAttachments([])

    responseTimeoutRef.current = setTimeout(() => {
      responseTimeoutRef.current = null
      startBotResponse(userMessage)
    }, 300)
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isGenerating) handleSend()
    }
  }

  const canSend = text.trim() || attachments.length > 0

  // ---------- render ----------

  return (
    <div className="mx-auto my-8 flex h-[650px] w-full max-w-4xl flex-col justify-between gap-4 rounded-2xl border bg-background p-6 shadow-md">
      <Header isGenerating={isGenerating} />

      <div className="min-h-0 flex-1">
        <MessageList messages={messages} />
      </div>

      <div className="relative w-full rounded-xl border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
        {attachments.length > 0 && (
          <AttachmentStrip
            attachments={attachments}
            disabled={isGenerating}
            onRemove={removeAttachment}
          />
        )}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          placeholder={isGenerating ? "Botul răspunde..." : "Ask me anything to expand your mind..."}
          className="min-h-[50px] max-h-[120px] p-1"
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ""
          }}
          className="hidden"
        />

        <div className="flex items-center justify-between border-t pt-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={isGenerating}
            onClick={() => fileInputRef.current?.click()}
            className="size-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="size-4" />
            <span className="sr-only">Atașează fișiere</span>
          </Button>

          {isGenerating ? (
            <Button
              variant="destructive"
              size="icon"
              onClick={stopBotResponse}
              className="size-8 shrink-0 animate-pulse rounded-full"
            >
              <Square className="size-3.5 fill-current" />
              <span className="sr-only">Oprește generarea</span>
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className="size-8 shrink-0 rounded-full"
            >
              <ArrowUpIcon className="size-4" />
              <span className="sr-only">Trimite</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Header({ isGenerating }) {
  return (
    <div className="flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-xl bg-primary/10 p-2.5 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Contexta</h1>
          <p className="text-xs text-muted-foreground">
            Instant answers and insights from your documents
          </p>
        </div>
      </div>
      <StatusBadge isGenerating={isGenerating} />
    </div>
  )
}

function AttachmentStrip({ attachments, disabled, onRemove }) {
  return (
    <div className="mb-2 flex flex-wrap gap-2 border-b p-2">
      {attachments.map((file) => (
        <div
          key={file.id}
          className="group relative flex items-center gap-2 rounded-lg border bg-muted p-1.5 pr-7 text-xs"
        >
          {file.type.startsWith("image/") ? (
            <img src={file.url} alt={file.name} className="size-8 rounded object-cover" />
          ) : (
            <FileText className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="max-w-[120px] truncate font-medium">{file.name}</span>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(file.id)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors hover:bg-black/10 disabled:opacity-50 dark:hover:bg-white/20"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
