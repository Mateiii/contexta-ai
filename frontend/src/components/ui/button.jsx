import { cn } from "@/lib/utils"

const VARIANTS = {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-muted hover:text-foreground",
  destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  // Neobrutalist look: thick border, hard offset shadow that
  // collapses on press instead of a color/opacity change.
  neo: "rounded-none border-[3px] border-black bg-[var(--neo-cyan)] text-black font-black uppercase tracking-wide shadow-[4px_4px_0px_#000] hover:brightness-95 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0px_#000]",
  "neo-pink": "rounded-none border-[3px] border-black bg-[var(--neo-pink)] text-white font-black uppercase tracking-wide shadow-[4px_4px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0px_#000]",
  "neo-yellow": "rounded-none border-[3px] border-black bg-[var(--neo-yellow)] text-black font-black uppercase tracking-wide shadow-[4px_4px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0px_#000]",
}

const SIZES = {
  default: "h-10 gap-1.5 px-6",
  icon: "size-10",
  "icon-sm": "size-8",
  sm: "h-8 gap-1.5 px-3 text-xs",
}

// Add more entries to VARIANTS / SIZES here if a new look is needed -
// keep it to values this app actually uses.
export function Button({ variant = "default", size = "default", className, ...props }) {
  const isNeo = variant.startsWith("neo")

  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-sm font-medium outline-none",
        isNeo
          ? "transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
          : "rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  )
}
