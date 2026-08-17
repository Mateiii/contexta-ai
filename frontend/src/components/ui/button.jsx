import { cn } from "@/lib/utils"

const VARIANTS = {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-muted hover:text-foreground",
  destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
}

const SIZES = {
  default: "h-10 gap-1.5 px-6",
  icon: "size-10",
}

// Add more entries to VARIANTS / SIZES here if a new look is needed -
// keep it to values this app actually uses.
export function Button({ variant = "default", size = "default", className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  )
}
