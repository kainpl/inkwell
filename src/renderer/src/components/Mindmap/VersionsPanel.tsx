import { useEffect, useState } from 'react'
import type { VersionEntry } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { projectVersionId } from '@renderer/lib/mindmap/projectVersionId'
import { restoreSchemaAsUntitled } from '@renderer/lib/mindmap/projectActions'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Schema version history: snapshots taken on each save. "Open" restores a snapshot
 *  non-destructively, as a new untitled project. */
export default function VersionsPanel(): JSX.Element | null {
  const activeId = useAppStore((s) => s.activeId)
  const open = useProjectStore((s) => s.byTab[activeId]?.versionsOpen ?? false)
  const srcPath = useProjectStore((s) => s.byTab[activeId]?.srcPath ?? '')
  const setVersionsOpen = useProjectStore((s) => s.setVersionsOpen)
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const vid = projectVersionId(srcPath)

  useEffect(() => {
    if (!open || !vid) return
    void window.api.listVersions(vid).then(setVersions)
  }, [open, vid])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setVersionsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setVersionsOpen])

  if (!open) return null

  const restore = (savedAt: number): void => {
    if (!vid) return
    void window.api.readVersion(vid, savedAt).then((schema) => {
      if (schema != null) void restoreSchemaAsUntitled(schema)
      setVersionsOpen(false)
    })
  }

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/30 p-8"
      onClick={() => setVersionsOpen(false)}
    >
      <div
        className="max-h-full w-[420px] overflow-auto rounded-lg border border-line bg-paper shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-sm font-medium text-ink">Schema history ({versions.length})</span>
          <button onClick={() => setVersionsOpen(false)} className="text-faint hover:text-ink" title="Close (Esc)">
            ✕
          </button>
        </div>
        {!vid ? (
          <div className="p-4 text-center text-sm text-faint">Save the project to start its history.</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-center text-sm text-faint">No snapshots yet.</div>
        ) : (
          <ul className="divide-y divide-line/60">
            {versions.map((v) => (
              <li key={v.savedAt} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-[13px] text-ink">
                  {new Date(v.savedAt).toLocaleString()}
                  <span className="ml-2 text-[11px] text-faint">{formatSize(v.size)}</span>
                </span>
                <button
                  onClick={() => restore(v.savedAt)}
                  className="shrink-0 rounded border border-line px-2 py-0.5 text-[12px] text-ink hover:border-accent hover:text-accent"
                  title="Open this snapshot as a new project"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
