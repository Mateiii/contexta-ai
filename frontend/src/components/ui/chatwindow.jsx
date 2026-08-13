import { useState, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUpIcon, Sparkles, Paperclip, X, FileText, Square } from "lucide-react"

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

import { StatusBadge } from "@/components/ui/StatusBadge"
import { ChatMessage } from "@/components/ui/message" // Observă că fișierul tău se numește message.jsx

const SAMPLE_BOT_RESPONSE =
  "Deocamdata nu iti pot raspunde deoarece nu mi-am gasit adevaratul potential"

export function ChatWindow() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [attachments, setAttachments] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)

  const timeoutRef = useRef(null)
  const intervalRef = useRef(null)
  const currentBotMsgIdRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const newAttachments = files.map((file) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }))

    setAttachments((prev) => [...prev, ...newAttachments])
    e.target.value = ""
  }

  const handleRemoveAttachment = (idToRemove) => {
    setAttachments((prev) => prev.filter((file) => file.id !== idToRemove))
  }

  const handleStop = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (currentBotMsgIdRef.current) {
      const idToRemove = currentBotMsgIdRef.current
      setMessages((prev) => prev.filter((msg) => msg.id !== idToRemove))
      currentBotMsgIdRef.current = null
    }

    setIsGenerating(false)
  }

  const simulateBotResponse = () => {
    setIsGenerating(true)

    const now = new Date()
    const formattedTime = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    const botMsgId = `msg_bot_${Date.now()}`
    currentBotMsgIdRef.current = botMsgId

    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        role: "assistant",
        content: "Thinking...",
        createdAt: formattedTime,
      },
    ])

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null

      setMessages((prev) =>
        prev.map((msg) => (msg.id === botMsgId ? { ...msg, content: "" } : msg))
      )

      const words = SAMPLE_BOT_RESPONSE.split(" ")
      let currentWordIndex = 0

      intervalRef.current = setInterval(() => {
        if (currentWordIndex < words.length) {
          const nextWord = words[currentWordIndex]

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId
                ? {
                    ...msg,
                    content: msg.content ? `${msg.content} ${nextWord}` : nextWord,
                  }
                : msg
            )
          )

          currentWordIndex++
        } else {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          currentBotMsgIdRef.current = null
          setIsGenerating(false)
        }
      }, 100)
    }, 2500)
  }

  const handleSend = () => {
    if (isGenerating) {
      handleStop()
      return
    }

    if (!text.trim() && attachments.length === 0) return

    const now = new Date()
    const formattedTime = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text,
      attachments: attachments,
      createdAt: formattedTime,
    }

    setMessages((prev) => [...prev, userMessage])
    setText("")
    setAttachments([])

    setTimeout(() => {
      simulateBotResponse()
    }, 300)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isGenerating) {
        handleSend()
      }
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto h-[650px] border rounded-2xl p-6 bg-background flex flex-col justify-between gap-4 my-8 shadow-md">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary flex items-center justify-center">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Contexta
            </h1>
            <p className="text-xs text-muted-foreground">
              Instant answers and insights from your documents
            </p>
          </div>
        </div>

        <StatusBadge isGenerating={isGenerating} />
      </div>

      {/* CHAT MESSAGES */}
      <MessageScrollerProvider>
        <MessageScroller className="h-full">
          <MessageScrollerViewport>
            <MessageScrollerContent className="flex flex-col gap-3 p-2">
              {messages.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-muted-foreground text-sm py-24 gap-2">
                  <Sparkles className="size-8 opacity-40" />
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* INPUT AREA */}
      <div className="relative w-full border rounded-xl bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b mb-2">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="relative group flex items-center gap-2 bg-muted p-1.5 rounded-lg text-xs pr-7 border"
              >
                {file.type.startsWith("image/") ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="size-8 object-cover rounded"
                  />
                ) : (
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate max-w-[120px] font-medium">
                  {file.name}
                </span>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleRemoveAttachment(file.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          placeholder={
            isGenerating
              ? "Botul răspunde..."
              : "Ask me anything to expand your mind..."
          }
          className="w-full min-h-[50px] max-h-[120px] resize-none text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
        />

        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isGenerating}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full text-muted-foreground hover:text-foreground size-8 disabled:opacity-40"
          >
            <Paperclip className="size-4" />
            <span className="sr-only">Atașează fișiere</span>
          </Button>

          {isGenerating ? (
            <Button
              type="button"
              size="icon"
              onClick={handleStop}
              variant="destructive"
              className="rounded-full size-8 shrink-0 animate-pulse"
            >
              <Square className="size-3.5 fill-current" />
              <span className="sr-only">Oprește generarea</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!text.trim() && attachments.length === 0}
              className="rounded-full size-8 shrink-0"
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