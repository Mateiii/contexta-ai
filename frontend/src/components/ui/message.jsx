import * as React from "react"

import { cn } from "@/lib/utils"

function MessageGroup({
  className,
  ...props
}) {
  return (
    <div
      data-slot="message-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props} />
  );
}

function Message({
  className,
  align = "start",
  ...props
}) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className
      )}
      {...props} />
  );
}

function MessageAvatar({
  className,
  ...props
}) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted group-has-data-[slot=message-footer]/message:-translate-y-8",
        className
      )}
      {...props} />
  );
}

function MessageContent({
  className,
  ...props
}) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        className
      )}
      {...props} />
  );
}

function MessageHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex max-w-full min-w-0 items-center px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase group-has-data-[variant=ghost]/message:px-0",
        className
      )}
      {...props} />
  );
}

function MessageFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex max-w-full min-w-0 items-center px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
        className
      )}
      {...props} />
  );
}

// Composed, ready-to-use chat bubble built from the primitives above.
// This is what ChatWindow actually needs: pass it a `message` object
// shaped like { id, role, content, attachments, createdAt }.
function ChatMessage({
  message,
  className,
  ...props
}) {
  const align = message.role === "user" ? "end" : "start"

  return (
    <Message align={align} className={className} {...props}>
      <MessageAvatar>
        {message.role === "user" ? "U" : "AI"}
      </MessageAvatar>
      <MessageContent>
        {message.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((file) => (
              <div
                key={file.id}
                className="rounded-md border bg-muted px-2 py-1 text-xs"
              >
                {file.name}
              </div>
            ))}
          </div>
        )}
        {message.content && (
          <div className="rounded-2xl bg-muted px-4 py-2 text-sm whitespace-pre-wrap">
            {message.content}
          </div>
        )}
        {message.createdAt && (
          <MessageFooter>{message.createdAt}</MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

export {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
  ChatMessage,
}
