import { useEffect, useState } from 'react'
import { IPC } from '@shared/ipc'
import { openPath } from '@renderer/lib/docActions'
import { getRecentFiles } from '@renderer/lib/persistence'
import { baseName } from '@renderer/lib/recentFiles'

/** Recent-files picker (File → Open Recent). Click to open, Esc to close. */
export default function RecentFiles(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<string[]>([])

  useEffect(() => {
    return window.api.onMenu(IPC.menuOpenRecent, () => {
      setFiles(getRecentFiles())
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const choose = (path: string): void => {
    setOpen(false)
    void openPath(path)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-[32rem] max-w-[90vw] overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-3 py-2 text-[12px] font-medium text-muted">
          Recent Files
        </div>
        <div className="max-h-80 overflow-y-auto">
          {files.length === 0 ? (
            <div className="px-3 py-3 text-sm text-faint">No recent files</div>
          ) : (
            files.map((path) => (
              <button
                key={path}
                onClick={() => choose(path)}
                title={path}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-ink/80 hover:bg-ink/5"
              >
                <span className="truncate">{baseName(path)}</span>
                <span className="shrink-0 truncate text-[11px] text-faint">{path}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
