import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject, useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { getProjectDoc } from '@renderer/lib/mindmap/yjsRegistry'
import { updateCrossLink, removeCrossLink } from '@renderer/lib/mindmap/crossLinkOps'
import type { CrossLink } from '@shared/mindmap/types'

/** Floating inspector for the selected cross-link: retype / relabel / delete. */
export default function EdgeInspector(): JSX.Element | null {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const selectLink = useProjectStore((s) => s.selectLink)
  const graph = useProjectGraph(activeId)
  const sel = project?.selectedLink ?? null
  if (!sel || !graph) return null
  const edge = graph.edges.find((e) => e.kind === 'cross' && e.linkId === sel.linkId)
  if (!edge) return null
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

  return (
    <div className="absolute bottom-3 left-3 z-10 w-60 rounded-md border border-line bg-paper p-2 shadow-lg">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">Cross-link</span>
        <button onClick={del} className="text-[12px] text-[#d35454] hover:underline">
          Delete
        </button>
      </div>
      <label className="mb-1 block text-[11px] text-faint">Type</label>
      <select
        value={type}
        onChange={(e) => patch({ type: e.target.value })}
        className="mb-2 w-full rounded border border-line bg-paper px-1 py-1 text-[13px] text-ink"
      >
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
        className="w-full rounded border border-line bg-paper px-1 py-1 text-[13px] text-ink outline-none"
      />
    </div>
  )
}
