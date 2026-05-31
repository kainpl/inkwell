import { useEffect, useState } from 'react'
import { IPC, type VersionEntry } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { draftId } from '@renderer/lib/drafts'
import { relativeTime } from '@renderer/lib/articles'

/** Human-readable byte size (e.g. "1.2 KB"). */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Browse the local version history of the current document (File → Browse All
 * Versions…). Pick a snapshot to preview it, then restore it into the editor as
 * unsaved changes so you can save or discard.
 */
export default function BrowseVersions(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [docPath, setDocPath] = useState<string | null>(null)
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [preview, setPreview] = useState('')
  const [now, setNow] = useState(0)

  useEffect(() => {
    return window.api.onMenu(IPC.menuBrowseVersions, () => {
      const { doc } = useAppStore.getState()
      setDocPath(doc.path)
      setSelected(null)
      setPreview('')
      setNow(Date.now())
      if (doc.path) {
        void window.api.listVersions(draftId(doc.path)).then(setVersions)
      } else {
        setVersions([])
      }
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

  const choose = (savedAt: number): void => {
    if (!docPath) return
    setSelected(savedAt)
    void window.api.readVersion(draftId(docPath), savedAt).then((c) => setPreview(c ?? ''))
  }

  const restore = (): void => {
    const { doc, loadDoc } = useAppStore.getState()
    loadDoc({ path: doc.path, name: doc.name, content: preview })
    useAppStore.setState((s) => ({ doc: { ...s.doc, dirty: true } }))
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[70vh] w-[52rem] max-w-[92vw] flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-3 py-2 text-[12px] font-medium text-muted">
          Browse All Versions
        </div>

        {docPath === null ? (
          <div className="px-3 py-3 text-sm text-faint">
            Save the document first to start keeping versions.
          </div>
        ) : versions.length === 0 ? (
          <div className="px-3 py-3 text-sm text-faint">
            No versions yet — they’re recorded each time you save.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Version list */}
            <div className="w-56 shrink-0 overflow-y-auto border-r border-line">
              {versions.map((v) => (
                <button
                  key={v.savedAt}
                  onClick={() => choose(v.savedAt)}
                  title={new Date(v.savedAt).toLocaleString()}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-ink/5 ${
                    selected === v.savedAt ? 'bg-ink/10 text-ink' : 'text-ink/80'
                  }`}
                >
                  <span className="truncate">{new Date(v.savedAt).toLocaleString()}</span>
                  <span className="shrink-0 text-[11px] text-faint">{relativeTime(v.savedAt, now)}</span>
                </button>
              ))}
            </div>

            {/* Preview of the selected version */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-auto p-3">
                {selected === null ? (
                  <div className="text-sm text-faint">Select a version to preview it.</div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink/80">
                    {preview}
                  </pre>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-line px-3 py-2">
                <span className="text-[11px] text-faint">
                  {selected !== null
                    ? formatSize(versions.find((v) => v.savedAt === selected)?.size ?? 0)
                    : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded px-3 py-1.5 text-sm text-ink hover:bg-ink/5"
                  >
                    Close
                  </button>
                  <button
                    onClick={restore}
                    disabled={selected === null}
                    className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-40"
                  >
                    Restore This Version
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
