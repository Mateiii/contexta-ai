import { cn } from "@/lib/utils"

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "w-full resize-none border-0 bg-transparent text-sm outline-none",
        "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}
