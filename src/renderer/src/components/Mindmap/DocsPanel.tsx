import { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { projectDocs } from '@renderer/lib/mindmap/projectDocs'
import { gcOrphanDocs, openDocRef, revealNode } from '@renderer/lib/mindmap/projectEditActions'

/** Doc-centric overlay: every bundle doc + the nodes that reference it (the M:N view).
 *  Click a doc to open it (via its first node); click a node chip to reveal it. */
export default function DocsPanel(): JSX.Element | null {
  const activeId = useAppStore((s) => s.activeId)
  const open = useProjectStore((s) => s.byTab[activeId]?.docsOpen ?? false)
  const setDocsOpen = useProjectStore((s) => s.setDocsOpen)
  const instructions = useProjectStore((s) => s.byTab[activeId]?.manifestInstructions ?? '')
  const setInstructions = useProjectStore((s) => s.setManifestInstructions)
  const graph = useProjectGraph(activeId)
  const [gcStatus, setGcStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDocsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setDocsOpen])

  if (!open) return null
  const docs = graph ? projectDocs(graph) : []
  const labelOf = (id: string): string => graph?.nodes.find((n) => n.id === id)?.label ?? id

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/30 p-8"
      onClick={() => setDocsOpen(false)}
    >
      <div
        className="max-h-full w-[460px] overflow-auto rounded-lg border border-line bg-paper shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-sm font-medium text-ink">Project documents ({docs.length})</span>
          <button onClick={() => setDocsOpen(false)} className="text-faint hover:text-ink" title="Close (Esc)">
            ✕
          </button>
        </div>
        <div className="border-b border-line px-3 py-2">
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-faint">Project notes</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Notes / schema rules / templates for this project…"
            rows={2}
            className="w-full resize-none rounded border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none placeholder:text-faint"
          />
        </div>
        {docs.length === 0 ? (
          <div className="p-4 text-center text-sm text-faint">No documents yet.</div>
        ) : (
          <ul className="divide-y divide-line/60">
            {docs.map((d) => (
              <li key={d.path} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      const id = d.nodeIds[0]
                      if (id) openDocRef(id, { path: d.path, title: d.title })
                      setDocsOpen(false)
                    }}
                    title={d.path}
                    className="min-w-0 flex-1 truncate text-left text-[13px] text-ink hover:text-accent"
                  >
                    📄 {d.title}
                  </button>
                  <span className="shrink-0 text-[11px] text-faint">
                    {d.nodeIds.length} node{d.nodeIds.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {d.nodeIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        revealNode(id)
                        setDocsOpen(false)
                      }}
                      title={`Reveal ${labelOf(id)}`}
                      className="max-w-[140px] truncate rounded bg-line/50 px-1 text-[11px] text-muted hover:text-ink"
                    >
                      {labelOf(id)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
          <span className="text-[11px] text-faint">{gcStatus ?? 'Remove docs/ files no node references.'}</span>
          <button
            onClick={() =>
              void gcOrphanDocs().then((n) =>
                setGcStatus(n ? `Removed ${n} unused file${n > 1 ? 's' : ''}.` : 'No unused files.')
              )
            }
            className="shrink-0 rounded border border-line px-2 py-0.5 text-[12px] text-ink hover:border-accent hover:text-accent"
          >
            Clean up unused
          </button>
        </div>
      </div>
    </div>
  )
}
