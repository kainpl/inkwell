import { useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { getProjectDoc } from '@renderer/lib/mindmap/yjsRegistry'
import { setNodeData, addTag, removeTag, addIcon, removeIcon } from '@renderer/lib/mindmap/nodeStyleOps'
import type { NodeData } from '@shared/mindmap/types'

const SHAPES = ['rounded', 'rectangle', 'pill', 'ellipse']

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
  const apply = (patch: Partial<NodeData>): void => withDoc((pd) => pd && setNodeData(pd.doc, sel, patch))

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
              withDoc((pd) => pd && addTag(pd.doc, sel, tagInput.trim()))
              setTagInput('')
            }
          }}
          placeholder="add tag ↵"
          className={`${field} w-full outline-none`}
        />
      </div>
    </div>
  )
}
