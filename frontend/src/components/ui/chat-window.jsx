import { useEffect, useRef, useState } from "react"
import { ArrowUpIcon, Folder, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageList } from "@/components/ui/message-list"
import { StatusBadge } from "@/components/ui/status-badge"

const BACKEND_URL = "http://localhost:5000"

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ChatWindow({ onToggleSidebar }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  // True while the backend is rebuilding the RAG.
  const [isRagBusy, setIsRagBusy] = useState(false)

  const pendingBotMessageId = useRef(null)
  const abortControllerRef = useRef(null)


  // ==========================================================
  // RAG STATUS
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    async function checkRagStatus() {
      try {
        const res = await fetch(
          `${BACKEND_URL}/rag/status`
        )

        if (!res.ok) {
          return
        }

        const data = await res.json()

        if (!cancelled) {
          setIsRagBusy(
            Boolean(data.busy)
          )
        }

      } catch (err) {

        console.error(
          "Failed to check RAG status:",
          err
        )
      }
    }

    // Check immediately.
    checkRagStatus()

    // Keep the frontend synchronized with the backend.
    const interval = setInterval(
      checkRagStatus,
      500
    )

    return () => {
      cancelled = true
      clearInterval(interval)
    }

  }, [])


  // ==========================================================
  // BOT RESPONSE
  // ==========================================================

  async function startBotResponse(userMessage) {

    // Extra protection on the frontend.
    if (isRagBusy) {
      return
    }

    setIsGenerating(true)

    const botMessageId =
      `msg_bot_${Date.now()}`

    pendingBotMessageId.current =
      botMessageId

    const abortController =
      new AbortController()

    abortControllerRef.current =
      abortController

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

      const res = await fetch(
        `${BACKEND_URL}/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          signal:
            abortController.signal,

          body: JSON.stringify({
            message: userMessage,
          }),
        }
      )


      // ------------------------------------------------------
      // Handle RAG becoming busy between the frontend check
      // and the actual request.
      // ------------------------------------------------------

      if (res.status === 409) {

        const data =
          await res.json().catch(
            () => ({})
          )

        throw new Error(
          data.error ||
          "Documents are currently being updated. Please wait."
        )
      }


      if (!res.ok) {

        throw new Error(
          `Backend a returnat ${res.status}`
        )
      }


      if (!res.body) {

        throw new Error(
          "Răspunsul nu conține un stream"
        )
      }


      // Clear "Gândesc..." once the stream starts.
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                content: "",
              }
            : msg
        )
      )


      const reader =
        res.body.getReader()

      const decoder =
        new TextDecoder()

      let buffer = ""


      // ------------------------------------------------------
      // Read SSE stream
      // ------------------------------------------------------

      while (true) {

        const {
          value,
          done,
        } = await reader.read()


        if (done) {
          break
        }


        buffer += decoder.decode(
          value,
          {
            stream: true,
          }
        )


        const events =
          buffer.split("\n\n")

        buffer =
          events.pop() || ""


        for (const event of events) {

          if (
            !event.startsWith(
              "data: "
            )
          ) {
            continue
          }


          const json =
            event.slice(
              "data: ".length
            )

          const data =
            JSON.parse(json)


          // --------------------------------------------------
          // Token
          // --------------------------------------------------

          if (
            data.type === "token"
          ) {

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,

                      content:
                        msg.content +
                        data.content,
                    }
                  : msg
              )
            )
          }


          // --------------------------------------------------
          // Error sent through stream
          // --------------------------------------------------

          if (
            data.type === "error"
          ) {

            throw new Error(
              data.content ||
              "Eroare necunoscută"
            )
          }


          // --------------------------------------------------
          // Done
          // --------------------------------------------------

          if (
            data.type === "done"
          ) {

            console.log(
              "Stream finalizat"
            )
          }
        }
      }


    } catch (err) {

      if (
        err.name === "AbortError"
      ) {
        return
      }


      console.error(err)


      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,

                content:
                  `❌ Eroare: ${err.message}`,
              }
            : msg
        )
      )


    } finally {

      if (
        abortControllerRef.current ===
        abortController
      ) {

        pendingBotMessageId.current =
          null

        abortControllerRef.current =
          null

        setIsGenerating(false)
      }
    }
  }


  // ==========================================================
  // STOP
  // ==========================================================

  function stopBotResponse() {

    abortControllerRef.current?.abort()

    abortControllerRef.current =
      null

    pendingBotMessageId.current =
      null

    setIsGenerating(false)
  }


  // ==========================================================
  // SEND
  // ==========================================================

  function handleSend() {

    // If the bot is generating, the button becomes STOP.
    if (isGenerating) {

      stopBotResponse()

      return
    }


    // Never send while RAG is rebuilding.
    if (isRagBusy) {
      return
    }


    if (!text.trim()) {
      return
    }


    const userMessage =
      text.trim()


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

    startBotResponse(
      userMessage
    )
  }


  // ==========================================================
  // KEYBOARD
  // ==========================================================

  function handleKeyDown(e) {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault()


      if (
        !isGenerating &&
        !isRagBusy
      ) {

        handleSend()
      }
    }
  }


  // ==========================================================
  // UI STATE
  // ==========================================================

  const canSend =
    text.trim().length > 0 &&
    !isRagBusy


  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">

      <Header
        isGenerating={isGenerating}
        isRagBusy={isRagBusy}
        onToggleSidebar={
          onToggleSidebar
        }
      />


      <div className="min-h-0 flex-1">
        <MessageList
          messages={messages}
        />
      </div>


      <div className="flex gap-3 border-t-[3px] border-black bg-white p-4">

        <Textarea
          variant="neo"
          value={text}
          onChange={(e) =>
            setText(e.target.value)
          }
          onKeyDown={
            handleKeyDown
          }

          disabled={
            isGenerating ||
            isRagBusy
          }

          placeholder={
            isGenerating
              ? "Botul răspunde..."
              : isRagBusy
                ? "Updating documents..."
                : "Type command or message..."
          }

          className="min-h-[46px] max-h-[120px]"
          rows={1}
        />


        {isGenerating ? (

          <Button
            variant="neo-pink"
            onClick={
              stopBotResponse
            }

            className="shrink-0 animate-pulse gap-2 px-5"
          >
            <Square className="size-3.5 fill-current" />

            STOP
          </Button>

        ) : (

          <Button
            variant="neo-pink"
            onClick={handleSend}

            disabled={
              !canSend
            }

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


// ============================================================
// Header
// ============================================================

function Header({
  isGenerating,
  isRagBusy,
  onToggleSidebar,
}) {

  return (
    <div className="flex items-center justify-between border-b-[3px] border-black bg-[var(--neo-cyan)] p-2 px-3">

      <div className="flex items-center gap-3">

        <Button
          variant="neo-yellow"
          size="sm"
          onClick={
            onToggleSidebar
          }
          className="gap-1.5"
        >
          <Folder className="size-3.5" />

          FILES
        </Button>


        <div>

          <h1 className="text-sm font-black uppercase tracking-wide text-black">
            Contexta
          </h1>

          <p className="text-[0.65rem] font-bold text-black/60">
            AKA Hababas AI
          </p>

        </div>

      </div>


      <StatusBadge
        isGenerating={
          isGenerating
        }
        isRagBusy={
          isRagBusy
        }
      />

    </div>
  )
}
