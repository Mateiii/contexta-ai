import { useHealthCheck } from "@/hooks/useHealthCheck"

export function StatusBadge({ isGenerating }) {
  const { isOnline } = useHealthCheck()

  const getStatusText = () => {
    if (isGenerating) return "Se generează..."
    if (isOnline) return "Online"
    return "Offline"
  }

  const getBadgeColor = () => {
    if (isGenerating) return "bg-amber-500 animate-ping"
    if (isOnline) return "bg-emerald-500 animate-pulse"
    return "bg-destructive animate-pulse"
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border">
      <span className={`size-2 rounded-full ${getBadgeColor()}`} />
      <span>{getStatusText()}</span>
    </div>
  )
}