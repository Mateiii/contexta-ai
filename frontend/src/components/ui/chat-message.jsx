// One chat bubble. Expects a message shaped like:
// { id, role: "user" | "assistant" | "system", content, attachments?, createdAt }
export function ChatMessage({ message }) {
  const isUser = message.role === "user"
  const label = isUser ? "USER" : message.role === "system" ? "SYSTEM" : "CONTEXTA"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`neo-message relative mt-4 max-w-[75%] px-4 py-3 ${
          isUser ? "bg-[var(--neo-pink)] text-right text-white" : "bg-white"
        }`}
      >
        <div
          className={`neo-badge absolute -top-3 px-2 py-0.5 text-[0.65rem] font-bold ${
            isUser ? "right-2" : "left-2 bg-[var(--neo-cyan)] text-black"
          }`}
        >
          {label}
        </div>

        {message.attachments?.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map((file) => (
              <div
                key={file.id}
                className="border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black"
              >
                {file.name}
              </div>
            ))}
          </div>
        )}

        {message.content && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        )}

        {message.createdAt && (
          <span
            className={`mt-1 block text-[0.65rem] font-bold ${
              isUser ? "text-white/70" : "text-black/50"
            }`}
          >
            {message.createdAt}
          </span>
        )}
      </div>
    </div>
  )
}
