import { cn } from "@/lib/utils"

export function Textarea({ className, variant = "default", ...props }) {
  return (
    <textarea
      className={cn(
        "w-full resize-none text-sm outline-none",
        "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        variant === "neo"
          ? "rounded-none border-[3px] border-black bg-white px-3 py-2.5 font-mono font-bold shadow-[inset_3px_3px_0px_rgba(0,0,0,0.1)] transition-colors duration-150 focus:bg-[#fffde7]"
          : "border-0 bg-transparent",
        className
      )}
      {...props}
    />
  )
}
