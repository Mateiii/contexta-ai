import { useHealthCheck } from "@/hooks/useHealthCheck"

const STATUS = {
  generating: { label: "Se generează...", dotClass: "bg-amber-500 animate-ping" },
  online: { label: "Online", dotClass: "bg-emerald-500 animate-pulse" },
  offline: { label: "Offline", dotClass: "bg-destructive animate-pulse" },
}

export function StatusBadge({ isGenerating }) {
  const { isOnline } = useHealthCheck()
  const key = isGenerating ? "generating" : isOnline ? "online" : "offline"
  const { label, dotClass } = STATUS[key]

  return (
    <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide">
      <span className={`size-2 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </div>
  )
}
