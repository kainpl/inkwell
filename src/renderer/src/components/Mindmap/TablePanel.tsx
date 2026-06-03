import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { visibleInOrder } from '@renderer/lib/mindmap/treeNav'
import { centerOnNode } from '@renderer/lib/mindmap/canvasViewport'
import { renameNode, toggleTask } from '@renderer/lib/mindmap/projectEditActions'

const EMPTY: Set<string> = new Set()
const TASK_MARK: Record<string, string> = { open: '☐', done: '☑', cancelled: '⊘' }

/** Table projection of the schema: one canonical model rendered as flat rows
 *  (label · task · tags · note). A sibling of the map/outline views — light edits
 *  (rename, task toggle) reuse the same ops, so all views stay in lockstep. */
export default function TablePanel(): JSX.Element {
  const activeId = useAppStore((s) => s.activeId)
  const graph = useProjectGraph(activeId)
  const collapsed = useProjectStore((s) => s.byTab[activeId]?.collapsed) ?? EMPTY
  const selectedId = useProjectStore((s) => s.byTab[activeId]?.selectedId ?? null)
  const select = useProjectStore((s) => s.select)

  const rows = graph ? visibleInOrder(graph, collapsed) : []
  const byId = new Map((graph?.nodes ?? []).map((n) => [n.id, n]))

  return (
    <div className="h-full overflow-auto bg-paper text-[13px]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-chrome text-[11px] uppercase tracking-wide text-faint">
          <tr>
            <th className="px-2 py-1 text-left font-medium">Node</th>
            <th className="w-8 px-1 py-1 text-center font-medium">✓</th>
            <th className="w-40 px-2 py-1 text-left font-medium">Tags</th>
            <th className="w-48 px-2 py-1 text-left font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, depth }) => {
            const n = byId.get(id)
            if (!n) return null
            const tags = Array.isArray(n.data.tag) ? n.data.tag : []
            const status = n.data.task
              ? typeof n.data.taskStatus === 'string'
                ? n.data.taskStatus
                : 'open'
              : null
            const note = typeof n.data.note === 'string' ? n.data.note : ''
            const fmt = `${n.data.bold ? 'font-bold ' : ''}${n.data.italic ? 'italic ' : ''}${n.data.underline ? 'underline ' : ''}`
            return (
              <tr
                key={id}
                onClick={() => {
                  select(id)
                  centerOnNode(id)
                }}
                className={`border-b border-line/60 ${id === selectedId ? 'bg-accent/15' : 'hover:bg-line/20'}`}
              >
                <td className="px-2 py-0.5" style={{ paddingLeft: depth * 16 + 8 }}>
                  <input
                    value={n.label}
                    onChange={(e) => renameNode(id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => select(id)}
                    placeholder="(empty)"
                    className={`w-full bg-transparent text-ink outline-none placeholder:text-faint ${fmt}`}
                  />
                </td>
                <td className="px-1 py-0.5 text-center">
                  {status ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTask(id)
                      }}
                      title={`Task: ${status} — click to cycle`}
                      className="hover:text-accent"
                    >
                      {TASK_MARK[status] ?? '☐'}
                    </button>
                  ) : null}
                </td>
                <td className="px-2 py-0.5">
                  <div className="flex flex-wrap gap-0.5">
                    {tags.map((t, i) => (
                      <span
                        key={i}
                        className="rounded bg-line/50 px-1 text-[10px] leading-tight text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="truncate px-2 py-0.5 text-muted" title={note}>
                  {note}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
