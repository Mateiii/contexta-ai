import { useState } from "react"
import { ChatWindow } from "@/components/ui/chat-window"
import { FileSidebar } from "@/components/ui/file-sidebar"

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <main className="neo-app flex min-h-screen items-center justify-center p-5">
      <div className="neo-window mx-auto flex h-[90vh] w-full max-w-[1200px] overflow-hidden">
        <FileSidebar
          collapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(true)}
        />
        <ChatWindow onToggleSidebar={() => setSidebarCollapsed((c) => !c)} />
      </div>
    </main>
  )
}