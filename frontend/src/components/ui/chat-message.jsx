// One chat bubble. Expects a message shaped like:
// { id, role: "user" | "assistant", content, attachments?, createdAt }
export function ChatMessage({ message }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="flex size-8 shrink-0 items-center justify-center self-end rounded-full bg-muted text-xs font-medium">
        {isUser ? "U" : "AI"}
      </div>

      <div className={`flex min-w-0 flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        {message.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((file) => (
              <div key={file.id} className="rounded-md border bg-muted px-2 py-1 text-xs">
                {file.name}
              </div>
            ))}
          </div>
        )}

        {message.content && (
          <div className="max-w-prose rounded-2xl bg-muted px-4 py-2 text-sm whitespace-pre-wrap">
            {message.content}
          </div>
        )}

        {message.createdAt && (
          <span className="px-1 text-xs text-muted-foreground">{message.createdAt}</span>
        )}
      </div>
    </div>
  )
}
