import { useEffect, useRef, useState } from "react"
import { FileText, Upload, X } from "lucide-react"

const BACKEND_URL = "http://localhost:5000"

function formatSize(bytes) {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function FileSidebar({ collapsed, onCollapse }) {
  const [files, setFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  const fileInputRef = useRef(null)

  // Load files already in the backend
  useEffect(() => {
    loadFiles()
  }, [])

  async function loadFiles() {
    try {
      const res = await fetch(`${BACKEND_URL}/upload`)

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load files")
      }

      setFiles(data)
    } catch (err) {
      console.error("Failed to load files:", err)
    }
  }

  // Upload selected files
  async function handleFileSelect(event) {
    const picked = Array.from(event.target.files || [])

    event.target.value = ""

    if (!picked.length) return

    setIsUploading(true)

    for (const file of picked) {
      const tempId = `file_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 9)}`

      setFiles((prev) => [
        {
          id: tempId,
          name: file.name,
          size: file.size,
        },
        ...prev,
      ])

      try {
        const formData = new FormData()

        formData.append("file", file)

        const res = await fetch(`${BACKEND_URL}/upload`, {
          method: "POST",
          body: formData,
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(
            data.error || `Upload failed (${res.status})`
          )
        }

        // Replace temporary ID with backend filename
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId
              ? {
                  ...f,
                  id: data.filename,
                  name: data.filename,
                }
              : f
          )
        )
      } catch (err) {
        console.error("Upload failed:", err)

        // Remove the file from the sidebar if upload failed
        setFiles((prev) =>
          prev.filter((f) => f.id !== tempId)
        )
      }
    }

    setIsUploading(false)
  }

  // Delete file from backend
  async function deleteFile(id) {
    setRemovingId(id)

    try {
      const res = await fetch(
        `${BACKEND_URL}/upload/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(
          data.error || `Delete failed (${res.status})`
        )
      }

      setTimeout(() => {
        setFiles((prev) =>
          prev.filter((file) => file.id !== id)
        )

        setRemovingId(null)
      }, 160)
    } catch (err) {
      console.error("Delete failed:", err)

      setRemovingId(null)

      alert(err.message)
    }
  }

  return (
    <div
      className="neo-sidebar-wrap"
      data-collapsed={collapsed}
    >
      <aside className="neo-sidebar-inner flex h-full flex-col">

        <div className="neo-badge flex items-center justify-between p-3">
          <span className="text-sm font-bold tracking-wide">
           FILES
          </span>
        </div>

        <div className="border-b-[3px] border-black bg-white p-4">

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFileSelect}
            accept=".txt,.pdf,.docx,.md,.json,.csv"
          />

          <button
            type="button"
            disabled={isUploading}
            onClick={() =>
              fileInputRef.current?.click()
            }
            className="flex w-full items-center justify-center gap-2 border-[3px] border-black bg-[var(--neo-cyan)] px-4 py-2.5 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0px_#000] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0px_#000] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="size-4" />

            {isUploading
              ? "Uploading..."
              : "[+] Upload file"}
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">

          {files.length === 0 ? (

            <p className="p-4 text-center text-xs font-bold leading-relaxed text-black/50">
              No files yet. Anything uploaded here is
              available to every conversation, not just
              this one.
            </p>

          ) : (

            files.map((file, index) => (

              <div
                key={file.id}
                data-removing={
                  removingId === file.id
                }
                className="neo-file-card flex items-center justify-between gap-2 p-2.5 text-xs"
                style={{
                  transitionDelay: removingId
                    ? "0ms"
                    : `${Math.min(index, 6) * 40}ms`,
                }}
              >

                <div className="flex min-w-0 items-center gap-2">

                  <FileText className="size-4 shrink-0" />

                  <span className="truncate font-bold">
                    {file.name}
                  </span>

                </div>

                <div className="flex shrink-0 items-center gap-2">

                  {file.size != null && (
                    <span className="text-black/50">
                      {formatSize(file.size)}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      deleteFile(file.id)
                    }
                    disabled={
                      removingId === file.id
                    }
                    title="Delete file"
                    className="neo-delete-btn flex size-6 items-center justify-center disabled:opacity-50"
                  >
                    <X className="size-3.5" />

                    <span className="sr-only">
                      Delete {file.name}
                    </span>
                  </button>

                </div>

              </div>

            ))
          )}

        </div>

      </aside>
    </div>
  )
}