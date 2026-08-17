import { useRef, useState } from "react"
import { ArrowUpIcon, FileText, Paperclip, Sparkles, Square, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageList } from "@/components/ui/message-list"
import { StatusBadge } from "@/components/ui/status-badge"

const SAMPLE_BOT_RESPONSE =
  "Deocamdata nu iti pot raspunde deoarece nu mi-am gasit adevaratul potential"
const THINKING_DELAY_MS = 2500 // pause before the bot "starts typing"
const WORD_STREAM_MS = 100 // delay between each streamed word

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ChatWindow() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [attachments, setAttachments] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Refs so handleStop can cancel whatever the bot-response simulation
  // has in flight, regardless of which stage it's in.
  const thinkingTimeout = useRef(null)
  const streamInterval = useRef(null)
  const pendingBotMessageId = useRef(null)
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

  // ---------- simulated bot response ----------
  // Stands in for a real backend call: shows "Thinking...", then
  // streams a canned reply one word at a time.

  function startBotResponse() {
    setIsGenerating(true)

    const botMessageId = `msg_bot_${Date.now()}`
    pendingBotMessageId.current = botMessageId

    setMessages((prev) => [
      ...prev,
      { id: botMessageId, role: "assistant", content: "Thinking...", createdAt: formatTime() },
    ])

    thinkingTimeout.current = setTimeout(() => {
      thinkingTimeout.current = null
      setMessages((prev) =>
        prev.map((msg) => (msg.id === botMessageId ? { ...msg, content: "" } : msg))
      )
      streamWords(botMessageId)
    }, THINKING_DELAY_MS)
  }

  function streamWords(botMessageId) {
    const words = SAMPLE_BOT_RESPONSE.split(" ")
    let index = 0

    streamInterval.current = setInterval(() => {
      if (index >= words.length) {
        clearInterval(streamInterval.current)
        streamInterval.current = null
        pendingBotMessageId.current = null
        setIsGenerating(false)
        return
      }

      const nextWord = words[index]
      index += 1

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, content: msg.content ? `${msg.content} ${nextWord}` : nextWord }
            : msg
        )
      )
    }, WORD_STREAM_MS)
  }

  function stopBotResponse() {
    if (thinkingTimeout.current) {
      clearTimeout(thinkingTimeout.current)
      thinkingTimeout.current = null
    }
    if (streamInterval.current) {
      clearInterval(streamInterval.current)
      streamInterval.current = null
    }
    if (pendingBotMessageId.current) {
      const idToRemove = pendingBotMessageId.current
      setMessages((prev) => prev.filter((msg) => msg.id !== idToRemove))
      pendingBotMessageId.current = null
    }
    setIsGenerating(false)
  }

  // ---------- send ----------

  function handleSend() {
    if (isGenerating) {
      stopBotResponse()
      return
    }
    if (!text.trim() && attachments.length === 0) return

    setMessages((prev) => [
      ...prev,
      { id: `msg_${Date.now()}`, role: "user", content: text, attachments, createdAt: formatTime() },
    ])
    setText("")
    setAttachments([])

    setTimeout(startBotResponse, 300)
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
