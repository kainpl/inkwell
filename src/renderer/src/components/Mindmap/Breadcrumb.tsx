import { Fragment } from 'react'
import { Panel } from '@xyflow/react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { ancestorsOf } from '@renderer/lib/mindmap/treeNav'
import { centerOnNode } from '@renderer/lib/mindmap/canvasViewport'
import type { GraphModel } from '@shared/mindmap/types'

/** Root → selected path of the selected node; click a crumb to select + center it. */
export default function Breadcrumb({ graph }: { graph: GraphModel | null }): JSX.Element | null {
  const activeId = useAppStore((s) => s.activeId)
  const sel = useProjectStore((s) => s.byTab[activeId]?.selectedId ?? null)
  const select = useProjectStore((s) => s.select)
  if (!graph || !sel) return null
  const path = [...ancestorsOf(graph, sel), sel]
  if (path.length < 2) return null // root only → nothing to show
  const labelOf = new Map(graph.nodes.map((n) => [n.id, n.label]))

  return (
    <Panel position="bottom-center" className="!mb-2 max-w-[80%]">
      <div className="flex items-center gap-1 overflow-hidden rounded-md border border-line bg-paper px-2 py-1 text-[11px] shadow">
        {path.map((id, i) => (
          <Fragment key={id}>
            {i > 0 ? <span className="shrink-0 text-faint">›</span> : null}
            <button
              onClick={() => {
                select(id)
                centerOnNode(id)
              }}
              className={`max-w-[160px] shrink truncate hover:text-accent ${
                id === sel ? 'font-medium text-ink' : 'text-muted'
              }`}
            >
              {labelOf.get(id) || '…'}
            </button>
          </Fragment>
        ))}
      </div>
    </Panel>
  )
}
