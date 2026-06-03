import { useAppStore } from '@renderer/store/useAppStore'
import { useActiveProject } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import {
  attachDocToSelected,
  attachExternalToSelected,
  attachImageToOpenDoc,
  createDocForSelected,
  detachDoc,
  internalizeOpenDoc,
  linkOpenDocAnchor,
  linkExistingDocToSelected,
  openDocRef,
  openExternalDoc,
  revealNode
} from '@renderer/lib/mindmap/projectEditActions'
import { getDocView, insertAnchorAtCaret } from '@renderer/lib/mindmap/docView'
import { listAnchors } from '@renderer/lib/mindmap/anchors'
import { projectDocs, nodesReferencing } from '@renderer/lib/mindmap/projectDocs'

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
  const openRef = sel && project?.openDoc?.nodeId === sel ? project.openDoc.ref : null
  const openIdx = openRef
    ? docs.findIndex((d) =>
        openRef.external ? d.external && d.src === openRef.src : d.path === openRef.path
      )
    : -1
  const openExternal = project?.openDoc?.ref.external === true
  const openInternal = project?.openDoc != null && !openExternal
  const openNodeId = project?.openDoc?.nodeId ?? null
  const openNodeLabel = openNodeId ? graph?.nodes.find((n) => n.id === openNodeId)?.label : null
  // Existing bundle docs not already attached to the selected node (the M:N "Link…" pool).
  const linkable = sel && graph ? projectDocs(graph).filter((d) => !d.nodeIds.includes(sel)) : []
  // Other nodes sharing the open internal doc (M:N — surfaces who else links it).
  const sharedWith =
    openInternal && openPath && graph
      ? nodesReferencing(graph, openPath).filter((id) => id !== openNodeId)
      : []
  const labelOf = (id: string): string => graph?.nodes.find((n) => n.id === id)?.label ?? id
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
      {openNodeId ? (
        <button
          className={`${BTN} shrink-0`}
          onClick={() => revealNode(openNodeId)}
          title="Reveal this document's node on the map"
        >
          ⌖ {openNodeLabel ?? 'node'}
        </button>
      ) : null}
      {sharedWith.length ? (
        <span className="flex shrink-0 items-center gap-1 text-faint" title="Also linked from">
          <span className="text-[11px]">🔗 also:</span>
          {sharedWith.map((id) => (
            <button
              key={id}
              onClick={() => revealNode(id)}
              title={`Reveal ${labelOf(id)}`}
              className="max-w-[90px] truncate rounded bg-line/50 px-1 text-[11px] text-muted hover:text-ink"
            >
              {labelOf(id)}
            </button>
          ))}
        </span>
      ) : null}
      {openInternal ? (
        <>
          <button className={BTN} onClick={() => insertAnchorAtCaret()} title="Insert an anchor at the caret">
            ⚓
          </button>
          <button
            className={BTN}
            onClick={() => void attachImageToOpenDoc()}
            title="Attach an image (into assets/) at the caret"
          >
            🖼
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
        title="Attach a .md from disk (copied into the bundle)"
      >
        Attach…
      </button>
      <button
        className={BTN}
        disabled={!sel}
        onClick={() => void attachExternalToSelected()}
        title="Reference an external .md (not copied in)"
      >
        Ext…
      </button>
      {linkable.length ? (
        <select
          value=""
          onChange={(e) => {
            const d = linkable.find((x) => x.path === e.target.value)
            if (d) linkExistingDocToSelected(d.path, d.title)
          }}
          title="Link an existing project doc to this node (many-to-many)"
          className="max-w-[28%] rounded border border-line bg-paper px-1 py-0.5 text-[12px] text-ink"
        >
          <option value="" disabled>
            Link…
          </option>
          {linkable.map((d) => (
            <option key={d.path} value={d.path}>
              {d.title}
            </option>
          ))}
        </select>
      ) : null}
      {openExternal ? (
        <>
          <button className={BTN} onClick={() => void openExternalDoc()} title="Re-grant + load the external file">
            Open
          </button>
          <button
            className={BTN}
            onClick={() => void internalizeOpenDoc()}
            title="Copy the external doc into the bundle"
          >
            Internalize
          </button>
        </>
      ) : null}
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
