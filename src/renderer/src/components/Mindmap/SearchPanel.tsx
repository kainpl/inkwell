import { useState } from 'react'
import { Panel, useReactFlow } from '@xyflow/react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { searchNodes, ancestorsOf } from '@renderer/lib/mindmap/treeNav'
import type { GraphModel } from '@shared/mindmap/types'
import type { Pos } from '@renderer/lib/mindmap/layout'

/** Canvas search box (rendered inside React Flow): filter nodes, reveal + center a
 *  match (expanding its collapsed ancestors), cycle with Enter / ↑ / ↓, Esc closes. */
export default function SearchPanel({
  graph,
  layout
}: {
  graph: GraphModel | null
  layout: Map<string, Pos>
}): JSX.Element | null {
  const activeId = useAppStore((s) => s.activeId)
  const open = useProjectStore((s) => s.byTab[activeId]?.searchOpen ?? false)
  const setSearchOpen = useProjectStore((s) => s.setSearchOpen)
  const { setCenter } = useReactFlow()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)

  if (!open) return null
  const matches = graph ? searchNodes(graph, q) : []

  const reveal = (i: number): void => {
    if (!graph || !matches.length) return
    const at = ((i % matches.length) + matches.length) % matches.length
    const id = matches[at]
    const store = useProjectStore.getState()
    for (const anc of ancestorsOf(graph, id)) store.expand(anc)
    store.select(id)
    const p = layout.get(id)
    if (p) void setCenter(p.x + 100, p.y + 16, { zoom: 1, duration: 300 })
    setIdx(at)
  }

  const onChange = (v: string): void => {
    setQ(v)
    setIdx(0)
    if (graph && searchNodes(graph, v).length) reveal(0)
  }

  return (
    <Panel position="top-center" className="!m-2">
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-2 py-1 shadow-lg">
        <input
          autoFocus
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) {
              e.preventDefault()
              reveal(idx + 1)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              reveal(idx - 1)
            } else if (e.key === 'Escape') {
              setSearchOpen(false)
              setQ('')
            }
          }}
          placeholder="Search nodes…"
          className="w-56 bg-transparent text-[13px] text-ink outline-none"
        />
        <span className="shrink-0 text-[11px] text-faint">
          {q ? `${matches.length ? idx + 1 : 0}/${matches.length}` : ''}
        </span>
        <button
          onClick={() => {
            setSearchOpen(false)
            setQ('')
          }}
          className="shrink-0 text-faint hover:text-ink"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>
    </Panel>
  )
}
