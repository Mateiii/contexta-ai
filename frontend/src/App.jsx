import { useState } from "react"
import { ChatWindow } from "@/components/ui/chat-window"
import { FileSidebar } from "@/components/ui/file-sidebar"
import { Toaster } from "@/components/ui/toast"

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [language, setLanguage] = useState("ro")

  return (
    <main className="neo-app flex min-h-screen items-center justify-center p-5">
      <div className="neo-window mx-auto flex h-[90vh] w-full max-w-[1200px] overflow-hidden">
        <FileSidebar
          collapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(true)}
        />
        <ChatWindow
          language={language}
          onLanguageChange={setLanguage}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />
      </div>
      <Toaster />
    </main>
  )
}
