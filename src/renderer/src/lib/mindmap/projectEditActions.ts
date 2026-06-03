import type { Doc as YDoc } from 'yjs'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { getProjectDoc } from './yjsRegistry'
import { saveProject } from './projectActions'
import { addChild, addSibling, remove as removeNode, rename, reparent, reorder } from './treeOps'
import { buildGraph } from './buildGraph'
import { yjsToOutline } from './yjsModel'
import { navigate, ancestorsOf } from './treeNav'
import { centerOnNode } from './canvasViewport'
import { removeCrossLink } from './crossLinkOps'
import { nodeDocs, pushDocRef, removeDocRef, replaceDocRef, setDocAnchor } from './docOps'
import {
  setNodeData,
  addTag,
  cycleTask,
  toggleLabelFlag,
  addExternalLink,
  removeExternalLink
} from './nodeStyleOps'
import { applyTheme } from './themes'
import { insertAtCaret } from './docView'
import { projectDocs } from './projectDocs'
import type { DocRef, NodeData } from '@shared/mindmap/types'

/** The full node selection of the active project tab (primary `selectedId` ∪ `multi`). */
function selectionIds(tabId: string): string[] {
  const e = useProjectStore.getState().byTab[tabId]
  if (!e) return []
  const ids = e.selectedId ? [e.selectedId] : []
  for (const id of e.multi) if (id !== e.selectedId) ids.push(id)
  return ids
}

/** The active project tab's id + Y.Doc, or null if the active tab isn't a project. */
function active(): { tabId: string; doc: YDoc } | null {
  const tabId = useAppStore.getState().activeId
  const pd = getProjectDoc(tabId)
  return pd ? { tabId, doc: pd.doc } : null
}

const markDirty = (tabId: string): void => useAppStore.getState().setTabDirty(tabId, true)
const selectedId = (tabId: string): string | null =>
  useProjectStore.getState().byTab[tabId]?.selectedId ?? null

/** Add an empty child under the selected node; expand the parent, select + edit it. */
export function addChildToSelected(): void {
  const a = active()
  if (!a) return
  const sel = selectedId(a.tabId)
  if (!sel) return
  const id = addChild(a.doc, sel)
  markDirty(a.tabId)
  const ps = useProjectStore.getState()
  ps.expand(sel)
  ps.beginEdit(id)
}

/** Add an empty child to a specific node (expand it, select + edit the new child). */
export function addChildTo(nodeId: string): void {
  const a = active()
  if (!a) return
  const id = addChild(a.doc, nodeId)
  markDirty(a.tabId)
  const ps = useProjectStore.getState()
  ps.expand(nodeId)
  ps.beginEdit(id)
}

/** Cycle a node's task status (none → open → done → cancelled → none). */
export function toggleTask(nodeId: string): void {
  const a = active()
  if (!a) return
  cycleTask(a.doc, nodeId)
  markDirty(a.tabId)
}

/** Toggle a whole-label format flag (bold/italic/underline) on a node. */
export function toggleLabel(nodeId: string, flag: 'bold' | 'italic' | 'underline'): void {
  const a = active()
  if (!a) return
  toggleLabelFlag(a.doc, nodeId, flag)
  markDirty(a.tabId)
}

/** Recolor the whole map from a curated palette (or `clear` to strip theme colors). */
export function applyMindmapTheme(key: string): void {
  const a = active()
  if (!a) return
  applyTheme(a.doc, key)
  markDirty(a.tabId)
}

// ── Outline-view edits (reuse the tree ops over the shared Yjs model) ──

/** Set a node's name (outline inline edit). */
export function renameNode(id: string, text: string): void {
  const a = active()
  if (!a) return
  rename(a.doc, id, text)
  markDirty(a.tabId)
}

/** Add an empty sibling after `id`, select it; returns its id (for focus). */
export function outlineAddSiblingAfter(id: string): string | null {
  const a = active()
  if (!a) return null
  const newId = addSibling(a.doc, id)
  markDirty(a.tabId)
  useProjectStore.getState().select(newId)
  return newId
}

/** Indent: make `id` a child of its previous sibling. */
export function outlineIndent(id: string): void {
  const a = active()
  if (!a) return
  const g = buildGraph(yjsToOutline(a.doc))
  const prev = navigate(g, id, 'up')
  if (prev && reparent(a.doc, id, prev)) markDirty(a.tabId)
}

/** Outdent: make `id` a sibling of its parent, just after it. */
export function outlineOutdent(id: string): void {
  const a = active()
  if (!a) return
  const g = buildGraph(yjsToOutline(a.doc))
  const parentId = g.nodes.find((n) => n.id === id)?.parentId ?? null
  if (parentId == null) return // already a root
  const grandparent = g.nodes.find((n) => n.id === parentId)?.parentId ?? null
  const sibs =
    grandparent === null
      ? g.nodes.filter((n) => n.parentId === null).map((n) => n.id)
      : (g.childrenOf.get(grandparent) ?? [])
  if (reorder(a.doc, id, grandparent, sibs.indexOf(parentId) + 1)) markDirty(a.tabId)
}

/** Delete `id` (with subtree); select + return the previous sibling or parent (for focus). */
export function outlineDelete(id: string): string | null {
  const a = active()
  if (!a) return null
  const g = buildGraph(yjsToOutline(a.doc))
  const prev = navigate(g, id, 'up') ?? g.nodes.find((n) => n.id === id)?.parentId ?? null
  removeNode(a.doc, id)
  markDirty(a.tabId)
  if (prev) useProjectStore.getState().select(prev)
  return prev
}

/** Quick-add a named child under `parentId` (no inline-rename — keeps the quick-entry focus). */
export function quickAddChild(parentId: string, text: string): void {
  const a = active()
  if (!a) return
  const id = addChild(a.doc, parentId)
  if (text.trim()) rename(a.doc, id, text.trim())
  markDirty(a.tabId)
  useProjectStore.getState().expand(parentId)
}

/** Add an empty sibling after the selected node; select + edit it. */
export function addSiblingToSelected(): void {
  const a = active()
  if (!a) return
  const sel = selectedId(a.tabId)
  if (!sel) return
  const id = addSibling(a.doc, sel)
  markDirty(a.tabId)
  useProjectStore.getState().beginEdit(id)
}

/** Delete the selected node + its subtree; clear selection and any open doc. */
export function deleteSelected(): void {
  const a = active()
  if (!a) return
  const sel = selectedId(a.tabId)
  if (!sel) return
  removeNode(a.doc, sel)
  markDirty(a.tabId)
  const ps = useProjectStore.getState()
  ps.clearDoc()
  ps.select(null)
}

/** Apply a style/data patch to the whole selection (one undo step via captureTimeout). */
export function styleSelection(patch: Partial<NodeData>): void {
  const a = active()
  if (!a) return
  const ids = selectionIds(a.tabId)
  if (!ids.length) return
  for (const id of ids) setNodeData(a.doc, id, patch)
  markDirty(a.tabId)
}

/** Add a tag to every node in the selection. */
export function addTagToSelection(tag: string): void {
  const a = active()
  if (!a) return
  const ids = selectionIds(a.tabId)
  if (!ids.length) return
  for (const id of ids) addTag(a.doc, id, tag)
  markDirty(a.tabId)
}

/** Delete every node in the selection (with subtrees) and clear the selection. */
export function deleteSelection(): void {
  const a = active()
  if (!a) return
  const ids = selectionIds(a.tabId)
  if (!ids.length) return
  for (const id of ids) removeNode(a.doc, id)
  markDirty(a.tabId)
  const ps = useProjectStore.getState()
  ps.clearDoc()
  ps.select(null)
}

/** Delete the selected cross-link and clear the link selection. */
export function deleteSelectedLink(): void {
  const a = active()
  if (!a) return
  const link = useProjectStore.getState().byTab[a.tabId]?.selectedLink
  if (!link) return
  removeCrossLink(a.doc, link.fromNodeId, link.linkId)
  markDirty(a.tabId)
  useProjectStore.getState().selectLink(null)
}

/** Enter inline-rename mode for the selected node. */
export function beginRenameSelected(): void {
  const tabId = useAppStore.getState().activeId
  const sel = selectedId(tabId)
  if (sel) useProjectStore.getState().beginEdit(sel)
}

/** Commit an inline rename and leave edit mode. */
export function commitRename(nodeId: string, name: string): void {
  const a = active()
  if (!a) return
  rename(a.doc, nodeId, name)
  markDirty(a.tabId)
  useProjectStore.getState().endEdit()
}

/** Abandon an inline rename (no change) and leave edit mode. */
export function cancelRename(): void {
  useProjectStore.getState().endEdit()
}

export function undoActive(): void {
  const a = active()
  if (!a) return
  const pd = getProjectDoc(a.tabId)
  if (pd?.undo.canUndo()) {
    pd.undo.undo()
    markDirty(a.tabId)
  }
}

export function redoActive(): void {
  const a = active()
  if (!a) return
  const pd = getProjectDoc(a.tabId)
  if (pd?.undo.canRedo()) {
    pd.undo.redo()
    markDirty(a.tabId)
  }
}

/** Save the active project tab back to its `.inkproj`. */
export function saveActive(): Promise<void> {
  return saveProject(useAppStore.getState().activeId)
}

/** Open a node's doc ref in the doc pane. */
export function openDocRef(nodeId: string, ref: DocRef): void {
  useProjectStore.getState().openDocFor(nodeId, ref)
}

/** Link the selected node to another `.inkproj` (user picks the file; path stored). */
export async function linkToProject(): Promise<void> {
  const a = active()
  if (!a) return
  const sel = selectedId(a.tabId)
  if (!sel) return
  const file = await window.api.inkproj.pickProjectFile()
  if (!file) return
  const title = file.split(/[\\/]/).pop()?.replace(/\.inkproj$/i, '') ?? 'Project'
  addExternalLink(a.doc, sel, file, title)
  markDirty(a.tabId)
}

/** Remove a node's cross-`.inkproj` link at `index`. */
export function removeProjectLink(nodeId: string, index: number): void {
  const a = active()
  if (!a) return
  removeExternalLink(a.doc, nodeId, index)
  markDirty(a.tabId)
}

/** Reveal a node on the map: expand its ancestors, select it, and center the viewport. */
export function revealNode(id: string): void {
  const a = active()
  if (!a) return
  const g = buildGraph(yjsToOutline(a.doc))
  const ps = useProjectStore.getState()
  for (const anc of ancestorsOf(g, id)) ps.expand(anc)
  ps.select(id)
  centerOnNode(id)
}

/** Attach an existing `.md` (copied into the bundle via a file dialog) to the selected node. */
export async function attachDocToSelected(): Promise<void> {
  const a = active()
  if (!a) return
  const sel = selectedId(a.tabId)
  if (!sel) return
  const wd = useProjectStore.getState().byTab[a.tabId]?.workingDir
  if (!wd) return
  const ref = await window.api.inkproj.attachDoc(wd)
  if (!ref) return
  pushDocRef(a.doc, sel, ref)
  markDirty(a.tabId)
  useProjectStore.getState().openDocFor(sel, ref)
}

/** Link an existing bundle doc (already in the project) to the selected node — the
 *  M:N attach. No-op-but-open if it's already linked here; otherwise push + open. */
export function linkExistingDocToSelected(path: string, title: string): void {
  const a = active()
  if (!a) return
  const sel = selectedId(a.tabId)
  if (!sel) return
  const ref: DocRef = { path, title }
  if (nodeDocs(a.doc, sel).some((r) => !r.external && r.path === path)) {
    useProjectStore.getState().openDocFor(sel, ref)
    return
  }
  pushDocRef(a.doc, sel, ref)
  markDirty(a.tabId)
  useProjectStore.getState().openDocFor(sel, ref)
}

/** Create a new (buffered) doc under the selected node and open it. */
export function createDocForSelected(): void {
  const a = active()
  if (!a) return
  const sel = selectedId(a.tabId)
  if (!sel) return
  const entry = useProjectStore.getState().byTab[a.tabId]
  if (!entry) return
  const used = new Set<string>([
    ...Object.keys(entry.dirtyDocs),
    ...nodeDocs(a.doc, sel)
      .map((r) => r.path)
      .filter((p): p is string => !!p)
  ])
  let path = `docs/${sel}.md`
  for (let i = 1; used.has(path); i++) path = `docs/${sel}-${i}.md`
  const ref: DocRef = { path, title: 'Untitled' }
  useProjectStore.getState().setDocBuffer(path, '# Untitled\n')
  pushDocRef(a.doc, sel, ref)
  markDirty(a.tabId)
  useProjectStore.getState().openDocFor(sel, ref)
}

/** Point the currently-open doc ref at an anchor (or clear it) and re-open to scroll. */
export function linkOpenDocAnchor(anchor: string | undefined): void {
  const a = active()
  if (!a) return
  const od = useProjectStore.getState().byTab[a.tabId]?.openDoc
  if (!od || !od.ref.path) return
  const index = nodeDocs(a.doc, od.nodeId).findIndex((r) => r.path === od.ref.path)
  if (index < 0) return
  setDocAnchor(a.doc, od.nodeId, index, anchor)
  markDirty(a.tabId)
  useProjectStore.getState().openDocFor(od.nodeId, { ...od.ref, anchor: anchor || undefined })
}

/** Attach an external `.md` (referenced, not copied) to the selected node + cache its content. */
export async function attachExternalToSelected(): Promise<void> {
  const a = active()
  if (!a) return
  const sel = selectedId(a.tabId)
  if (!sel) return
  const picked = await window.api.inkproj.pickExternal()
  if (!picked) return
  const ref: DocRef = { external: true, src: picked.src, title: picked.title }
  pushDocRef(a.doc, sel, ref)
  useProjectStore.getState().setExternalDoc(picked.src, picked.content)
  markDirty(a.tabId)
  useProjectStore.getState().openDocFor(sel, ref)
}

/** Re-grant + load the open external doc's content (user picks the file again). */
export async function openExternalDoc(): Promise<void> {
  const tabId = useAppStore.getState().activeId
  const od = useProjectStore.getState().byTab[tabId]?.openDoc
  if (!od?.ref.external || !od.ref.src) return
  const picked = await window.api.inkproj.pickExternal()
  if (!picked) return
  useProjectStore.getState().setExternalDoc(od.ref.src, picked.content)
  useProjectStore.getState().openDocFor(od.nodeId, { ...od.ref })
}

/** Internalize the open external doc: copy a user-picked file into the bundle, swap the ref. */
export async function internalizeOpenDoc(): Promise<void> {
  const a = active()
  if (!a) return
  const entry = useProjectStore.getState().byTab[a.tabId]
  const od = entry?.openDoc
  if (!entry || !od?.ref.external) return
  const internal = await window.api.inkproj.internalize(entry.workingDir)
  if (!internal) return
  const index = nodeDocs(a.doc, od.nodeId).findIndex((r) => r.external && r.src === od.ref.src)
  if (index < 0) return
  replaceDocRef(a.doc, od.nodeId, index, internal)
  markDirty(a.tabId)
  useProjectStore.getState().openDocFor(od.nodeId, internal)
}

/** Copy a user-picked image into the bundle's `assets/` and insert a markdown ref
 *  at the doc caret (the HTML export inlines it). */
export async function attachImageToOpenDoc(): Promise<void> {
  const entry = useProjectStore.getState().byTab[useAppStore.getState().activeId]
  if (!entry) return
  const path = await window.api.inkproj.attachAsset(entry.workingDir)
  if (path) insertAtCaret(`![](${path})`)
}

/** Delete bundle `docs/` files no node references (orphaned-doc GC). Marks the tab
 *  dirty so the next save persists the cleaned bundle. Returns the removed count. */
export async function gcOrphanDocs(): Promise<number> {
  const a = active()
  if (!a) return 0
  const entry = useProjectStore.getState().byTab[a.tabId]
  if (!entry) return 0
  const graph = buildGraph(yjsToOutline(a.doc))
  const keep = [...new Set([...projectDocs(graph).map((d) => d.path), ...Object.keys(entry.dirtyDocs)])]
  const deleted = await window.api.inkproj.gcDocs(entry.workingDir, keep)
  if (deleted.length) markDirty(a.tabId)
  return deleted.length
}

/** Detach the doc ref at `index` from a node (the bundled file stays). */
export function detachDoc(nodeId: string, index: number): void {
  const a = active()
  if (!a) return
  removeDocRef(a.doc, nodeId, index)
  markDirty(a.tabId)
  useProjectStore.getState().clearDoc()
}
