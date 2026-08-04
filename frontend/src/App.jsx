import { useState } from "react"
import "./App.css"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUpIcon, Sparkles } from "lucide-react"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

export default function App() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")

  const handleSend = () => {
    if (!text.trim()) return

    const now = new Date()
    const formattedTime = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    const newMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: formattedTime,
    }

    setMessages((prev) => [...prev, newMessage])
    setText("")
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    /* max-w-4xl face containerul mult mai lat. Poți schimba în max-w-5xl dacă îl vrei uriaș */
    <div className="max-w-4xl mx-auto h-[650px] border rounded-2xl p-6 bg-background flex flex-col justify-between gap-4 my-8 shadow-md">
      
      {/* --- HEADER: Numele Chatbot-ului (Contexta) --- */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary flex items-center justify-center">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-black flex items-center gap-2">
  Contexta
</h1>
            <p className="text-xs text-muted-foreground">
              Analiză inteligentă și răspunsuri din fișierele tale
            </p>
          </div>
        </div>

        {/* Badge discret de status */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Online</span>
        </div>
      </div>

      {/* --- ZONA DE MESAJE --- */}
      <MessageScrollerProvider>
        <MessageScroller className="h-full">
          <MessageScrollerViewport>
            <MessageScrollerContent className="flex flex-col gap-3 p-2">
              {messages.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-muted-foreground text-sm py-24 gap-2">
                  <Sparkles className="size-8 opacity-40" />
                  <p className="font-medium">Începe o conversație cu Contexta</p>
                  <p className="text-xs opacity-70">Trimite un mesaj sau adaugă fișiere pentru analiză.</p>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <div
                      className={`p-3.5 rounded-2xl text-sm max-w-[70%] shadow-sm ${
                        message.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground rounded-br-none"
                          : "mr-auto bg-muted text-muted-foreground rounded-bl-none"
                      }`}
                    >
                      <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                      <span className="text-[10px] opacity-70 block mt-1.5 text-right">
                        {message.createdAt}
                      </span>
                    </div>
                  </MessageScrollerItem>
                ))
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* --- INPUT AREA --- */}
      <div className="relative pt-2 border-t">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scrie un mesaj pentru Contexta..."
          className="pr-14 min-h-[55px] resize-none text-sm pt-3"
        />
        <Button
          type="button"
          size="icon-sm"
          onClick={handleSend}
          disabled={!text.trim()}
          className="absolute right-2 bottom-2.5 rounded-full"
        >
          <ArrowUpIcon className="size-4" />
          <span className="sr-only">Trimite</span>
        </Button>
      </div>
    </div>
  )
}