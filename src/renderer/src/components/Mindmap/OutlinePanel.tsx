import { useEffect, useRef } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { visibleInOrder } from '@renderer/lib/mindmap/treeNav'
import { centerOnNode } from '@renderer/lib/mindmap/canvasViewport'
import {
  renameNode,
  outlineAddSiblingAfter,
  outlineIndent,
  outlineOutdent,
  outlineDelete
} from '@renderer/lib/mindmap/projectEditActions'

const EMPTY: Set<string> = new Set()

/** The schema as an editable indented outline over the same Yjs model. Structural
 *  edits reuse the tree ops, so the map stays in lockstep (no text round-trip). */
export default function OutlinePanel(): JSX.Element {
  const activeId = useAppStore((s) => s.activeId)
  const graph = useProjectGraph(activeId)
  const collapsed = useProjectStore((s) => s.byTab[activeId]?.collapsed) ?? EMPTY
  const selectedId = useProjectStore((s) => s.byTab[activeId]?.selectedId ?? null)
  const select = useProjectStore((s) => s.select)
  const toggleCollapse = useProjectStore((s) => s.toggleCollapse)

  const inputs = useRef(new Map<string, HTMLInputElement>())
  const pendingFocus = useRef<string | null>(null)
  // After a structural edit re-renders the list, focus the requested row's input.
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    const el = inputs.current.get(id)
    if (el) {
      el.focus()
      el.select()
      pendingFocus.current = null
    }
  })

  const rows = graph ? visibleInOrder(graph, collapsed) : []
  const byId = new Map((graph?.nodes ?? []).map((n) => [n.id, n]))

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, id: string): void => {
    e.stopPropagation()
    const empty = e.currentTarget.value === ''
    if (e.key === 'Enter') {
      e.preventDefault()
      pendingFocus.current = outlineAddSiblingAfter(id)
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      outlineIndent(id)
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      outlineOutdent(id)
    } else if (e.key === 'Backspace' && empty) {
      e.preventDefault()
      pendingFocus.current = outlineDelete(id)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const i = rows.findIndex((r) => r.id === id)
      const next = rows[e.key === 'ArrowUp' ? i - 1 : i + 1]
      if (next) inputs.current.get(next.id)?.focus()
    } else if (e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  return (
    <div className="h-full overflow-auto bg-paper py-1 text-[13px]">
      {rows.map(({ id, depth }) => {
        const n = byId.get(id)
        if (!n) return null
        const hasChildren = (graph?.childrenOf.get(id)?.length ?? 0) > 0
        const tags = Array.isArray(n.data.tag) ? n.data.tag : []
        const hasDoc = Array.isArray(n.data.docs) && n.data.docs.length > 0
        return (
          <div
            key={id}
            style={{ paddingLeft: depth * 16 + 6 }}
            className={`flex items-center gap-1 py-0.5 pr-2 ${id === selectedId ? 'bg-accent/15' : ''}`}
          >
            {hasChildren ? (
              <button
                onClick={() => toggleCollapse(id)}
                className="w-3 shrink-0 text-faint hover:text-ink"
              >
                {collapsed.has(id) ? '▸' : '▾'}
              </button>
            ) : (
              <span className="w-3 shrink-0 text-center text-faint">·</span>
            )}
            <input
              ref={(el) => {
                if (el) inputs.current.set(id, el)
                else inputs.current.delete(id)
              }}
              value={n.label}
              onChange={(e) => renameNode(id, e.target.value)}
              onFocus={() => {
                select(id)
                centerOnNode(id)
              }}
              onKeyDown={(e) => onKey(e, id)}
              placeholder="(empty)"
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
            />
            {hasDoc ? <span className="shrink-0 text-faint">📄</span> : null}
            {tags.map((t, i) => (
              <span key={i} className="shrink-0 rounded bg-line/50 px-1 text-[10px] leading-tight text-muted">
                {t}
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
