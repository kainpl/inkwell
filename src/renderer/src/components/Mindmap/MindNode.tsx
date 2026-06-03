import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import {
  commitRename,
  cancelRename,
  addChildTo,
  toggleTask
} from '@renderer/lib/mindmap/projectEditActions'
import { openProjectFromPath } from '@renderer/lib/mindmap/projectActions'
import { useAssetDataUri } from '@renderer/lib/mindmap/useAssetDataUri'
import type { RfNodeData } from '@renderer/lib/mindmap/rfModel'

/** Node outline shape → border-radius class (border + shadow preserved). */
const SHAPE_RADIUS: Record<string, string> = {
  rectangle: 'rounded-none',
  pill: 'rounded-full',
  ellipse: 'rounded-[50%] px-4',
  rounded: 'rounded-md',
  cloud: 'rounded-[1.4rem]'
}

/** Polygon shapes via clip-path — drawn as two stacked clipped layers (outline + fill). */
const SHAPE_CLIP: Record<string, string> = {
  hexagon: 'polygon(14% 0%, 86% 0%, 100% 50%, 86% 100%, 14% 100%, 0% 50%)',
  octagon: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
}

/** Custom React Flow node for the schema canvas (inline-editable in project tabs). */
export default function MindNode({ id, data }: NodeProps): JSX.Element {
  const toggleCollapse = useProjectStore((s) => s.toggleCollapse)
  const beginEdit = useProjectStore((s) => s.beginEdit)
  const setHighlightTag = useProjectStore((s) => s.setHighlightTag)
  const activeId = useAppStore((s) => s.activeId)
  const editing = useProjectStore((s) => s.byTab[activeId]?.editingId === id)
  const highlightTag = useProjectStore((s) => s.byTab[activeId]?.highlightTag ?? null)
  const vertical = useProjectStore((s) => s.byTab[activeId]?.direction === 'down')
  const workingDir = useProjectStore((s) => s.byTab[activeId]?.workingDir ?? null)
  const nd = data as RfNodeData
  const d = nd.raw.data
  const imageUri = useAssetDataUri(workingDir, typeof d.image === 'string' ? d.image : undefined)
  const fill = typeof d.fillColor === 'string' ? d.fillColor : undefined
  const textColor = typeof d.color === 'string' ? d.color : undefined
  const borderColor = [d.lineColor, d.borderColor].find((c) => typeof c === 'string' && c) as
    | string
    | undefined
  const hasDoc = Array.isArray(d.docs) && d.docs.length > 0
  const icons = Array.isArray(d.icon) ? d.icon : []
  const tags = Array.isArray(d.tag) ? d.tag : []
  const shape = typeof d.shape === 'string' ? d.shape : 'rounded'
  const shapeClass = SHAPE_RADIUS[shape] ?? 'rounded-md'
  const clip = SHAPE_CLIP[shape]
  const ringColor = nd.selected ? 'rgb(var(--accent))' : borderColor ?? 'rgb(var(--line))'
  const taskStatus = d.task ? (typeof d.taskStatus === 'string' ? d.taskStatus : 'open') : null
  const taskMark = taskStatus === 'done' ? '☑' : taskStatus === 'cancelled' ? '⊘' : '☐'
  const labelStrike = taskStatus === 'done' || taskStatus === 'cancelled'
  const fmt = `${d.bold ? 'font-bold ' : ''}${d.italic ? 'italic ' : ''}${d.underline ? 'underline ' : ''}`
  const note = typeof d.note === 'string' && d.note.trim() ? d.note : null
  const extLinks = Array.isArray(d.extLinks) ? d.extLinks : []

  // Polygon shapes can't keep a border/shadow (clip-path removes them), so they
  // get a px-5 gutter + two stacked clipped layers for the outline; radius shapes
  // keep the plain bordered box.
  const boxClass = clip
    ? `relative isolate max-w-[230px] px-5 py-1 text-[13px] transition-opacity ${nd.dimmed ? 'opacity-30' : ''}`
    : `relative max-w-[230px] border border-line bg-paper px-2 py-1 text-[13px] shadow-sm transition-opacity ${shapeClass} ${nd.selected ? 'ring-2 ring-accent ' : ''}${nd.dimmed ? 'opacity-30' : ''}`
  const boxStyle = clip
    ? { color: textColor, clipPath: clip }
    : { background: fill, color: textColor, borderColor }

  return (
    <div className="group relative">
      <div className={boxClass} style={boxStyle}>
        {clip ? (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{ clipPath: clip, background: ringColor }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -z-10"
              style={{ inset: nd.selected ? 3 : 1.5, clipPath: clip, background: fill ?? 'rgb(var(--paper))' }}
            />
          </>
        ) : null}
        <Handle
          type="target"
          position={vertical ? Position.Top : Position.Left}
          className="!h-2 !w-2 !border-paper !bg-accent opacity-0 transition-opacity group-hover:opacity-100"
        />
        {imageUri ? (
          <img src={imageUri} alt="" className="mb-1 max-h-20 w-full rounded object-cover" />
        ) : null}
        <div className="flex items-center gap-1">
        {nd.hasChildren && !nd.collapsed ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleCollapse(id)
            }}
            className="shrink-0 text-faint hover:text-ink"
            aria-label="Collapse"
          >
            ▾
          </button>
        ) : null}
        {taskStatus ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              toggleTask(id)
            }}
            title={`Task: ${taskStatus} — click to cycle`}
            className="shrink-0 leading-none hover:text-accent"
          >
            {taskMark}
          </button>
        ) : null}
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
            className={`min-w-0 truncate ${fmt}${labelStrike ? 'line-through opacity-60' : ''}`}
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
        {note ? (
          <span title={note} className="shrink-0 text-faint">
            📝
          </span>
        ) : null}
      </div>
      {extLinks.length ? (
        <div className="mt-0.5 flex flex-wrap gap-0.5">
          {extLinks.map((l, i) => (
            <button
              key={i}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                // Only open `.inkproj` paths — a crafted document's link can't read an arbitrary file.
                if (typeof l.file === 'string' && /\.inkproj$/i.test(l.file)) void openProjectFromPath(l.file)
              }}
              title={`Open project: ${l.file}`}
              className="rounded bg-line/50 px-1 text-[10px] leading-tight text-muted hover:text-accent"
            >
              🔗 {l.title}
            </button>
          ))}
        </div>
      ) : null}
      {tags.length ? (
        <div className="mt-0.5 flex flex-wrap gap-0.5">
          {tags.map((t, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                setHighlightTag(t)
              }}
              title="Highlight this tag"
              className={`rounded px-1 text-[10px] leading-tight ${
                t === highlightTag ? 'bg-accent text-paper' : 'bg-line/50 text-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}
        <Handle
          type="source"
          position={vertical ? Position.Bottom : Position.Right}
          className="!h-2 !w-2 !border-paper !bg-accent opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
      {/* "Tail" control at the branch junction: expand when collapsed children are
          hidden, else add a child. A short stub line connects it to the node. Sits on
          the growth-side edge (right for horizontal, bottom for vertical) and at wrapper
          level so clip-path shapes (hexagon/octagon) don't hide it. */}
      <span
        className={`absolute bg-line ${
          vertical
            ? 'bottom-0 left-1/2 h-3 w-px -translate-x-1/2 translate-y-full'
            : 'right-0 top-1/2 h-px w-3 -translate-y-1/2 translate-x-full'
        }`}
      />
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          if (nd.hasChildren && nd.collapsed) toggleCollapse(id)
          else addChildTo(id)
        }}
        title={nd.hasChildren && nd.collapsed ? 'Expand' : 'Add child'}
        className={`absolute z-10 flex h-4 w-4 items-center justify-center rounded-full border border-line bg-paper text-[11px] leading-none text-faint shadow-sm hover:border-accent hover:text-accent ${
          vertical
            ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-[150%]'
            : 'right-0 top-1/2 -translate-y-1/2 translate-x-[150%]'
        }`}
      >
        {nd.hasChildren && nd.collapsed ? (vertical ? '▾' : '▸') : '+'}
      </button>
    </div>
  )
}
