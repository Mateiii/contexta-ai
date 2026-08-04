import './App.css'
import { Message } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

export const mockMessages = [
  {
    id: "msg_1",
    role: "user",
    content: "Salut! Mă poți ajuta să configurez un chat scroller în React?",
    createdAt: "10:30 AM"
  },
  {
    id: "msg_2",
    role: "assistant",
    content: "Salut! Cu siguranță. Ai deja componentele create pentru viewport și items?",
    createdAt: "10:30 AM"
  },
  {
    id: "msg_3",
    role: "user",
    content: "Da, am structura cu `MessageScrollerProvider`, dar am nevoie de date simulate ca să le pot rula.",
    createdAt: "10:31 AM"
  },
  {
    id: "msg_4",
    role: "assistant",
    content: "Perfect! Iată un exemplu de obiecte de date pe care le poți folosi direct în `.map()`.",
    createdAt: "10:31 AM"
  },
  {
    id: "msg_5",
    role: "assistant",
    content: "Puteți adăuga mesaje mai lungi pentru a testa derularea (scroll-ul) automat când ecranul devine plin:\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    createdAt: "10:32 AM"
  },
  {
    id: "msg_6",
    role: "user",
    content: "Arată excelent! Mersi mult.",
    createdAt: "10:33 AM"
  }
];

export default function App() {
  const messages = mockMessages;

  return (
    <div className="max-w-2xl mx-auto h-[500px] border rounded-lg p-4 bg-background">
      <MessageScrollerProvider>
        <MessageScroller className="h-full">
          <MessageScrollerViewport>
            <MessageScrollerContent className="flex flex-col gap-3 p-2">
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  <div
                    className={`p-3 rounded-lg text-sm max-w-[80%] ${
                      message.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto bg-muted text-muted-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.content}</p>
                    <span className="text-[10px] opacity-70 block mt-1 text-right">
                      {message.createdAt}
                    </span>
                  </div>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
}
