import { useEffect, useState } from 'react'
import type { VersionEntry } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { projectVersionId } from '@renderer/lib/mindmap/projectVersionId'
import { buildGraph } from '@renderer/lib/mindmap/buildGraph'
import { diffGraphs, type GraphDiff } from '@renderer/lib/mindmap/diffGraphs'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import { restoreSchemaAsUntitled } from '@renderer/lib/mindmap/projectActions'
import { rollbackToSchema } from '@renderer/lib/mindmap/projectEditActions'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isEmpty = (d: GraphDiff): boolean =>
  !d.added.length && !d.removed.length && !d.renamed.length && !d.moved.length
const names = (refs: { label: string }[]): string =>
  refs
    .slice(0, 4)
    .map((r) => r.label || '(empty)')
    .join(', ') + (refs.length > 4 ? ` +${refs.length - 4}` : '')

/** Edit history: schema snapshots (on save + debounced edits). Select a snapshot to see
 *  what restoring it would change vs the current map; restore in place or open as new. */
export default function VersionsPanel(): JSX.Element | null {
  const activeId = useAppStore((s) => s.activeId)
  const open = useProjectStore((s) => s.byTab[activeId]?.versionsOpen ?? false)
  const srcPath = useProjectStore((s) => s.byTab[activeId]?.srcPath ?? '')
  const setVersionsOpen = useProjectStore((s) => s.setVersionsOpen)
  const graph = useProjectGraph(activeId)
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [diff, setDiff] = useState<GraphDiff | null>(null)
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

  const select = (savedAt: number): void => {
    if (!vid) return
    if (selected === savedAt) {
      setSelected(null)
      setDiff(null)
      return
    }
    void window.api.readVersion(vid, savedAt).then((schema) => {
      if (schema == null) return
      const snap = buildGraph(markdownToOutline(schema).outline)
      setSelected(savedAt)
      setDiff(graph ? diffGraphs(graph, snap) : null)
    })
  }
  const restoreHere = (savedAt: number): void => {
    if (!vid) return
    void window.api.readVersion(vid, savedAt).then((schema) => {
      if (schema != null) rollbackToSchema(schema)
      setVersionsOpen(false)
    })
  }
  const openAsNew = (savedAt: number): void => {
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
        className="max-h-full w-[440px] overflow-auto rounded-lg border border-line bg-paper shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-sm font-medium text-ink">Edit history ({versions.length})</span>
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
              <li key={v.savedAt} className="px-3 py-2">
                <button
                  onClick={() => select(v.savedAt)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="min-w-0 truncate text-[13px] text-ink">
                    {new Date(v.savedAt).toLocaleString()}
                    <span className="ml-2 text-[11px] text-faint">{formatSize(v.size)}</span>
                  </span>
                  <span className="shrink-0 text-faint">{selected === v.savedAt ? '▾' : '▸'}</span>
                </button>
                {selected === v.savedAt ? (
                  <div className="mt-2 rounded border border-line bg-chrome/40 p-2 text-[12px]">
                    {!diff || isEmpty(diff) ? (
                      <div className="text-faint">Identical to the current map.</div>
                    ) : (
                      <>
                        <div className="mb-1 text-faint">Restoring this would:</div>
                        {diff.added.length ? (
                          <div>
                            <span className="text-[#3a9a3a]">＋ add</span> {names(diff.added)}
                          </div>
                        ) : null}
                        {diff.removed.length ? (
                          <div>
                            <span className="text-[#d35454]">− remove</span> {names(diff.removed)}
                          </div>
                        ) : null}
                        {diff.renamed.length ? <div>✎ rename {diff.renamed.length}</div> : null}
                        {diff.moved.length ? <div>⇄ move {names(diff.moved)}</div> : null}
                      </>
                    )}
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => openAsNew(v.savedAt)}
                        className="rounded border border-line px-2 py-0.5 text-ink hover:border-accent hover:text-accent"
                        title="Open this snapshot as a new project"
                      >
                        Open as new
                      </button>
                      <button
                        onClick={() => restoreHere(v.savedAt)}
                        className="rounded border border-accent bg-accent px-2 py-0.5 text-paper hover:opacity-90"
                        title="Roll the current map back to this snapshot (undoable)"
                      >
                        Restore here
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
