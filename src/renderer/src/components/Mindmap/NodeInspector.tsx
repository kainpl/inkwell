import { useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { getProjectDoc } from '@renderer/lib/mindmap/yjsRegistry'
import { removeTag, addIcon, removeIcon, setNodeData } from '@renderer/lib/mindmap/nodeStyleOps'
import {
  styleSelection,
  addTagToSelection,
  toggleTask,
  toggleLabel,
  linkToProject,
  removeProjectLink,
  setNodeImage,
  clearNodeImage
} from '@renderer/lib/mindmap/projectEditActions'
import type { NodeData } from '@shared/mindmap/types'

const SHAPES = ['rounded', 'rectangle', 'pill', 'ellipse', 'cloud', 'hexagon', 'octagon', 'line', 'embedded']

/** Floating inspector for the selected node: colors, shape, icons, tags. */
export default function NodeInspector(): JSX.Element | null {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const graph = useProjectGraph(activeId)
  const [tagInput, setTagInput] = useState('')
  const [iconInput, setIconInput] = useState('')

  const sel = project?.selectedId ?? null
  const editing = project?.editingId != null
  const node = sel && graph ? graph.nodes.find((n) => n.id === sel) : null
  if (!sel || !node || editing) return null
  const d: NodeData = node.data
  const icons = Array.isArray(d.icon) ? d.icon : []
  const tags = Array.isArray(d.tag) ? d.tag : []

  const withDoc = (fn: (doc: ReturnType<typeof getProjectDoc>) => void): void => {
    const pd = getProjectDoc(activeId)
    if (!pd) return
    fn(pd)
    useAppStore.getState().setTabDirty(activeId, true)
  }
  // Colors/shape apply to the whole selection (primary ∪ multi); single node when not multi-selecting.
  const apply = (patch: Partial<NodeData>): void => styleSelection(patch)

  const colorRow = (label: string, key: 'fillColor' | 'color' | 'lineColor'): JSX.Element => {
    const v = d[key]
    return (
      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[11px] text-faint">{label}</span>
        <input
          type="color"
          value={typeof v === 'string' ? v : '#ffffff'}
          onChange={(e) => apply({ [key]: e.target.value })}
          className="h-6 w-8 rounded border border-line"
        />
        {typeof v === 'string' ? (
          <button onClick={() => apply({ [key]: undefined })} className="text-[11px] text-faint hover:text-ink">
            clear
          </button>
        ) : null}
      </div>
    )
  }

  const field = 'rounded border border-line bg-paper px-1 py-0.5 text-[12px] text-ink'

  return (
    <div className="absolute bottom-3 left-3 z-10 w-60 space-y-2 rounded-md border border-line bg-paper p-2 shadow-lg">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-faint">Node</span>
      {colorRow('Fill', 'fillColor')}
      {colorRow('Text', 'color')}
      {colorRow('Line', 'lineColor')}

      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[11px] text-faint">Shape</span>
        <select
          value={typeof d.shape === 'string' ? d.shape : 'rounded'}
          onChange={(e) => apply({ shape: e.target.value })}
          className={`${field} flex-1`}
        >
          {SHAPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[11px] text-faint">Task</span>
        <button
          onClick={() => toggleTask(sel)}
          title="Cycle task status (none → open → done → cancelled)"
          className={`${field} flex-1 text-left capitalize hover:border-accent`}
        >
          {d.task ? (typeof d.taskStatus === 'string' ? d.taskStatus : 'open') : 'none'} ↻
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[11px] text-faint">Frame</span>
        <select
          value={typeof d.frame === 'string' ? d.frame : ''}
          onChange={(e) => apply({ frame: (e.target.value || undefined) as NodeData['frame'] })}
          className={`${field} flex-1`}
        >
          <option value="">none</option>
          <option value="bracket">bracket</option>
          <option value="underline">underline</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[11px] text-faint">Label</span>
        {(['bold', 'italic', 'underline'] as const).map((f) => (
          <button
            key={f}
            onClick={() => toggleLabel(sel, f)}
            title={f}
            className={`${field} w-7 ${f === 'bold' ? 'font-bold' : f === 'italic' ? 'italic' : 'underline'} ${
              d[f] ? 'border-accent text-accent' : ''
            }`}
          >
            {f === 'bold' ? 'B' : f === 'italic' ? 'I' : 'U'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[11px] text-faint">Font</span>
        <input
          type="number"
          min={9}
          max={40}
          value={typeof d.fontSize === 'number' ? d.fontSize : ''}
          onChange={(e) => apply({ fontSize: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="px"
          className={`${field} w-14`}
        />
        <select
          value={typeof d.fontFamily === 'string' ? d.fontFamily : ''}
          onChange={(e) => apply({ fontFamily: e.target.value || undefined })}
          className={`${field} flex-1`}
        >
          <option value="">default</option>
          <option value="serif">serif</option>
          <option value="monospace">mono</option>
          <option value="cursive">cursive</option>
        </select>
      </div>

      <textarea
        value={typeof d.note === 'string' ? d.note : ''}
        onChange={(e) => withDoc((pd) => pd && setNodeData(pd.doc, sel, { note: e.target.value }))}
        placeholder="note…"
        rows={2}
        className={`${field} w-full resize-none outline-none`}
      />

      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-[11px] text-faint">Image</span>
        <button onClick={() => void setNodeImage()} className={`${field} flex-1 text-left hover:border-accent`}>
          {typeof d.image === 'string' ? 'Change…' : 'Set image…'}
        </button>
        {typeof d.image === 'string' ? (
          <button onClick={() => clearNodeImage(sel)} className="text-[11px] text-faint hover:text-ink">
            clear
          </button>
        ) : null}
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {icons.map((ic, i) => (
            <button
              key={i}
              onClick={() => withDoc((pd) => pd && removeIcon(pd.doc, sel, i))}
              title="Remove icon"
              className="rounded bg-line/40 px-1 text-[13px]"
            >
              {ic}
            </button>
          ))}
        </div>
        <input
          value={iconInput}
          onChange={(e) => setIconInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && iconInput.trim()) {
              withDoc((pd) => pd && addIcon(pd.doc, sel, iconInput.trim()))
              setIconInput('')
            }
          }}
          placeholder="add icon (emoji) ↵"
          className={`${field} w-full outline-none`}
        />
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => withDoc((pd) => pd && removeTag(pd.doc, sel, t))}
              title="Remove tag"
              className="rounded bg-line/40 px-1 text-[11px] text-muted"
            >
              {t} ✕
            </button>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tagInput.trim()) {
              addTagToSelection(tagInput.trim())
              setTagInput('')
            }
          }}
          placeholder="add tag ↵"
          className={`${field} w-full outline-none`}
        />
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {(Array.isArray(d.extLinks) ? d.extLinks : []).map((l, i) => (
            <button
              key={i}
              onClick={() => removeProjectLink(sel, i)}
              title={`Remove link: ${l.file}`}
              className="rounded bg-line/40 px-1 text-[11px] text-muted"
            >
              🔗 {l.title} ✕
            </button>
          ))}
        </div>
        <button onClick={() => void linkToProject()} className={`${field} w-full text-left hover:border-accent`}>
          Link project…
        </button>
      </div>
    </div>
  )
}
