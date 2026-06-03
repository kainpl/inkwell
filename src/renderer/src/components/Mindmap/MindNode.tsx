import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { commitRename, cancelRename } from '@renderer/lib/mindmap/projectEditActions'
import type { RfNodeData } from '@renderer/lib/mindmap/rfModel'

/** Node outline shape → border-radius class. */
const SHAPE_RADIUS: Record<string, string> = {
  rectangle: 'rounded-none',
  pill: 'rounded-full',
  ellipse: 'rounded-[50%] px-4',
  rounded: 'rounded-md'
}

/** Custom React Flow node for the schema canvas (inline-editable in project tabs). */
export default function MindNode({ id, data }: NodeProps): JSX.Element {
  const toggleCollapse = useProjectStore((s) => s.toggleCollapse)
  const beginEdit = useProjectStore((s) => s.beginEdit)
  const activeId = useAppStore((s) => s.activeId)
  const editing = useProjectStore((s) => s.byTab[activeId]?.editingId === id)
  const nd = data as RfNodeData
  const d = nd.raw.data
  const fill = typeof d.fillColor === 'string' ? d.fillColor : undefined
  const textColor = typeof d.color === 'string' ? d.color : undefined
  const borderColor = [d.lineColor, d.borderColor].find((c) => typeof c === 'string' && c) as
    | string
    | undefined
  const hasDoc = Array.isArray(d.docs) && d.docs.length > 0
  const icons = Array.isArray(d.icon) ? d.icon : []
  const tags = Array.isArray(d.tag) ? d.tag : []
  const shapeClass = SHAPE_RADIUS[typeof d.shape === 'string' ? d.shape : 'rounded'] ?? 'rounded-md'

  return (
    <div
      className={
        `group max-w-[230px] border border-line bg-paper px-2 py-1 text-[13px] shadow-sm ${shapeClass} ` +
        (nd.selected ? 'ring-2 ring-accent' : '')
      }
      style={{ background: fill, color: textColor, borderColor }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-paper !bg-accent opacity-0 transition-opacity group-hover:opacity-100"
      />
      <div className="flex items-center gap-1">
        {nd.hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapse(id)
            }}
            className="shrink-0 text-faint hover:text-ink"
            aria-label={nd.collapsed ? 'Expand' : 'Collapse'}
          >
            {nd.collapsed ? '▸' : '▾'}
          </button>
        ) : null}
        {d.task ? <span className="shrink-0">{d.taskStatus === 'done' ? '☑' : '☐'}</span> : null}
        {icons.map((ic, i) => (
          <span key={i} className="shrink-0">
            {ic}
          </span>
        ))}
        {editing ? (
          <input
            autoFocus
            defaultValue={nd.label}
            onFocus={(e) => e.currentTarget.select()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') commitRename(id, e.currentTarget.value.trim())
              else if (e.key === 'Escape') cancelRename()
            }}
            onBlur={(e) => commitRename(id, e.currentTarget.value.trim())}
            className="min-w-0 flex-1 rounded border border-accent bg-paper px-1 text-[13px] text-ink outline-none"
          />
        ) : (
          <span
            className="min-w-0 truncate"
            title={nd.label}
            onDoubleClick={(e) => {
              e.stopPropagation()
              beginEdit(id)
            }}
          >
            {nd.label}
          </span>
        )}
        {hasDoc ? (
          <span title="Has document" className="shrink-0 text-faint">
            📄
          </span>
        ) : null}
      </div>
      {tags.length ? (
        <div className="mt-0.5 flex flex-wrap gap-0.5">
          {tags.map((t, i) => (
            <span key={i} className="rounded bg-line/50 px-1 text-[10px] leading-tight text-muted">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-paper !bg-accent opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
}
