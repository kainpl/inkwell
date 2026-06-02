import type { Doc as YDoc } from 'yjs'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { getProjectDoc } from './yjsRegistry'
import { saveProject } from './projectActions'
import { addChild, addSibling, remove as removeNode, rename } from './treeOps'

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
