import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import {
  attachDocToSelected,
  createDocForSelected,
  detachDoc,
  linkOpenDocAnchor,
  openDocRef
} from '@renderer/lib/mindmap/projectEditActions'
import { getDocView, insertAnchorAtCaret } from '@renderer/lib/mindmap/docView'
import { listAnchors } from '@renderer/lib/mindmap/anchors'

const BTN = 'rounded px-2 py-1 text-[12px] text-ink enabled:hover:bg-line/40 disabled:opacity-40'

/** Right-pane header: the selected node's docs + new / attach / detach actions. */
export default function DocBar(): JSX.Element {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const graph = useProjectGraph(activeId)
  const sel = project?.selectedId ?? null
  const node = sel && graph ? graph.nodes.find((n) => n.id === sel) : null
  const docs = node?.data.docs ?? []
  const openPath = project?.openDoc?.ref.path ?? null
  const dirty = openPath != null && project?.dirtyDocs[openPath] != null
  const openIdx =
    sel && project?.openDoc?.nodeId === sel ? docs.findIndex((d) => d.path === openPath) : -1
  const openInternal = project?.openDoc != null && project.openDoc.ref.external !== true
  const openAnchor = project?.openDoc?.ref.anchor ?? ''
  const anchors = openInternal ? listAnchors(getDocView()?.state.doc.toString() ?? '') : []

  return (
    <div className="flex items-center gap-2 border-b border-line bg-chrome px-2 py-1 text-[12px]">
      {docs.length > 1 ? (
        <select
          value={openPath ?? ''}
          onChange={(e) => {
            const ref = docs.find((d) => d.path === e.target.value)
            if (sel && ref) openDocRef(sel, ref)
          }}
          className="min-w-0 max-w-[55%] rounded border border-line bg-paper px-1 py-0.5 text-[12px] text-ink"
        >
          {docs.map((d, i) => (
            <option key={i} value={d.path ?? ''}>
              {d.title ?? d.path}
            </option>
          ))}
        </select>
      ) : (
        <span className="min-w-0 truncate text-faint">
          {docs[0]?.title ?? docs[0]?.path ?? (sel ? 'No document' : 'No node selected')}
        </span>
      )}
      {dirty ? (
        <span title="Unsaved edits" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      ) : null}
      {openInternal ? (
        <>
          <button className={BTN} onClick={() => insertAnchorAtCaret()} title="Insert an anchor at the caret">
            ⚓
          </button>
          <select
            value={openAnchor}
            onChange={(e) => linkOpenDocAnchor(e.target.value || undefined)}
            title="Link this node to an anchor in the doc"
            className="max-w-[30%] rounded border border-line bg-paper px-1 py-0.5 text-[12px] text-ink"
          >
            <option value="">no anchor</option>
            {anchors.map((a) => (
              <option key={a.id} value={`#${a.id}`}>
                #{a.id}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <span className="flex-1" />
      <button className={BTN} disabled={!sel} onClick={() => createDocForSelected()} title="New document">
        New
      </button>
      <button
        className={BTN}
        disabled={!sel}
        onClick={() => void attachDocToSelected()}
        title="Attach a .md from disk"
      >
        Attach…
      </button>
      <button
        className={BTN}
        disabled={openIdx < 0}
        onClick={() => sel && detachDoc(sel, openIdx)}
        title="Detach the open document"
      >
        Detach
      </button>
    </div>
  )
}
