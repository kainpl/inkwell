import { useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject, useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { getProjectDoc } from '@renderer/lib/mindmap/yjsRegistry'
import { updateCrossLink, removeCrossLink } from '@renderer/lib/mindmap/crossLinkOps'
import type { CrossLink } from '@shared/mindmap/types'

type Arrow = 'to' | 'none' | 'both'

/** kebab-case slug for a custom link-type key. */
const slug = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Floating inspector for the selected cross-link: retype / relabel / delete + new type. */
export default function EdgeInspector(): JSX.Element | null {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const selectLink = useProjectStore((s) => s.selectLink)
  const addLinkType = useProjectStore((s) => s.addLinkType)
  const graph = useProjectGraph(activeId)
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('#7a8aa0')
  const [arrow, setArrow] = useState<Arrow>('to')

  const sel = project?.selectedLink ?? null
  const edge = sel && graph ? graph.edges.find((e) => e.kind === 'cross' && e.linkId === sel.linkId) : null
  if (!sel || !edge) return null
  const linkTypes = project?.linkTypes ?? {}
  const type = edge.type ?? 'relates-to'

  const patch = (p: Partial<Pick<CrossLink, 'type' | 'label'>>): void => {
    const pd = getProjectDoc(activeId)
    if (!pd) return
    updateCrossLink(pd.doc, sel.fromNodeId, sel.linkId, p)
    useAppStore.getState().setTabDirty(activeId, true)
  }
  const del = (): void => {
    const pd = getProjectDoc(activeId)
    if (pd) {
      removeCrossLink(pd.doc, sel.fromNodeId, sel.linkId)
      useAppStore.getState().setTabDirty(activeId, true)
    }
    selectLink(null)
  }
  const addType = (): void => {
    const key = slug(label)
    if (!key) return
    addLinkType(key, { label: label.trim(), color, arrow, directed: arrow !== 'none' })
    patch({ type: key })
    setShowForm(false)
    setLabel('')
  }

  const field = 'w-full rounded border border-line bg-paper px-1 py-1 text-[13px] text-ink'

  return (
    <div className="absolute bottom-3 left-3 z-10 w-60 rounded-md border border-line bg-paper p-2 shadow-lg">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">Cross-link</span>
        <button onClick={del} className="text-[12px] text-[#d35454] hover:underline">
          Delete
        </button>
      </div>

      <label className="mb-1 block text-[11px] text-faint">Type</label>
      <select value={type} onChange={(e) => patch({ type: e.target.value })} className={`${field} mb-2`}>
        {Object.entries(linkTypes).map(([key, t]) => (
          <option key={key} value={key}>
            {t.label}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-[11px] text-faint">Label</label>
      <input
        key={sel.linkId}
        defaultValue={edge.label ?? ''}
        onChange={(e) => patch({ label: e.target.value })}
        placeholder="(optional)"
        className={`${field} outline-none`}
      />

      {showForm ? (
        <div className="mt-2 space-y-1.5 border-t border-line pt-2">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="New type label"
            className={`${field} outline-none`}
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-9 shrink-0 rounded border border-line"
            />
            <select value={arrow} onChange={(e) => setArrow(e.target.value as Arrow)} className={field}>
              <option value="to">arrow →</option>
              <option value="none">no arrow</option>
              <option value="both">both ↔</option>
            </select>
          </div>
          <div className="flex justify-end gap-1">
            <button onClick={() => setShowForm(false)} className="px-2 py-1 text-[12px] text-faint hover:text-ink">
              Cancel
            </button>
            <button
              onClick={addType}
              disabled={!slug(label)}
              className="rounded bg-accent px-2 py-1 text-[12px] text-paper disabled:opacity-40"
            >
              Add &amp; apply
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-2 text-[12px] text-accent hover:underline"
        >
          + New type…
        </button>
      )}
    </div>
  )
}
