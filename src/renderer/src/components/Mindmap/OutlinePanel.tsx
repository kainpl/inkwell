import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { visibleInOrder } from '@renderer/lib/mindmap/treeNav'
import { centerOnNode } from '@renderer/lib/mindmap/canvasViewport'

const EMPTY: Set<string> = new Set()

/** The schema as an indented outline over the same Yjs model: select + collapse
 *  in lockstep with the map. (Editing arrives in M8-B.) */
export default function OutlinePanel(): JSX.Element {
  const activeId = useAppStore((s) => s.activeId)
  const graph = useProjectGraph(activeId)
  const collapsed = useProjectStore((s) => s.byTab[activeId]?.collapsed) ?? EMPTY
  const selectedId = useProjectStore((s) => s.byTab[activeId]?.selectedId ?? null)
  const select = useProjectStore((s) => s.select)
  const toggleCollapse = useProjectStore((s) => s.toggleCollapse)

  const rows = graph ? visibleInOrder(graph, collapsed) : []
  const byId = new Map((graph?.nodes ?? []).map((n) => [n.id, n]))

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
            onClick={() => {
              select(id)
              centerOnNode(id)
            }}
            style={{ paddingLeft: depth * 16 + 6 }}
            className={`flex cursor-pointer items-center gap-1 py-0.5 pr-2 hover:bg-line/20 ${
              id === selectedId ? 'bg-accent/15' : ''
            }`}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleCollapse(id)
                }}
                className="w-3 shrink-0 text-faint hover:text-ink"
              >
                {collapsed.has(id) ? '▸' : '▾'}
              </button>
            ) : (
              <span className="w-3 shrink-0 text-center text-faint">·</span>
            )}
            <span className="truncate text-ink">{n.label || '(empty)'}</span>
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
