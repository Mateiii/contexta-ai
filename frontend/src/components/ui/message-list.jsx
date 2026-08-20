import { useEffect, useRef, useState } from "react"
import { ArrowDownIcon } from "lucide-react"
import { ChatMessage } from "@/components/ui/chat-message"

// How close to the bottom (in px) counts as "at the bottom" for
// deciding whether to auto-scroll and whether to show the jump button.
const BOTTOM_THRESHOLD_PX = 40

export function MessageList({ messages }) {
  const viewportRef = useRef(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollToBottom = (behavior = "smooth") => {
    const el = viewportRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }

  // Follow new messages automatically, but only if the user was
  // already near the bottom (don't yank them down while reading up).
  useEffect(() => {
    if (isAtBottom) scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  const handleScroll = () => {
    const el = viewportRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsAtBottom(distanceFromBottom < BOTTOM_THRESHOLD_PX)
  }

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto p-5"
        style={{
          backgroundColor: "#fafafa",
          backgroundImage: "radial-gradient(#ccc 2px, transparent 2px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-24 text-xs font-bold uppercase tracking-wide text-black/40">
              No messages yet. Type a command below.
            </div>
          ) : (
            messages.map((message) => <ChatMessage key={message.id} message={message} />)
          )}
        </div>
      </div>

      {!isAtBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="neo-icon-btn absolute bottom-3 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center bg-white"
        >
          <ArrowDownIcon className="size-4" />
          <span className="sr-only">Scroll to latest</span>
        </button>
      )}
    </div>
  )
}
