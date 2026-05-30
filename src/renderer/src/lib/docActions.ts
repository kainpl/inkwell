import { useAppStore } from '@renderer/store/useAppStore'
import { useConfirm } from '@renderer/store/useConfirm'

/**
 * Document operations that may discard unsaved work, all funnelled through
 * `guardUnsaved()` so the user is never surprised. Used by the menu wiring
 * (App.tsx), the file tree, and the window-close handler.
 */

/** Save to the current path, or fall back to Save As. Returns false if canceled. */
export async function saveDoc(): Promise<boolean> {
  const { doc, markSaved } = useAppStore.getState()
  if (doc.path) {
    await window.api.saveFile(doc.path, doc.content)
    markSaved()
    return true
  }
  return saveDocAs()
}

/** Save As via a native dialog. Returns false if the user cancels the dialog. */
export async function saveDocAs(): Promise<boolean> {
  const { doc, markSaved } = useAppStore.getState()
  const result = await window.api.saveFileAs(doc.content)
  if (!result) return false
  markSaved(result.path, result.name)
  return true
}

/**
 * If the document has unsaved changes, ask the user. Returns true when it is
 * safe to proceed (changes saved or discarded), false to abort the operation.
 */
export async function guardUnsaved(): Promise<boolean> {
  if (!useAppStore.getState().doc.dirty) return true
  const choice = await useConfirm.getState().ask()
  if (choice === 'cancel') return false
  if (choice === 'save') return saveDoc() // false if Save As is canceled → abort
  return true // discard
}

export async function newDocument(): Promise<void> {
  if (await guardUnsaved()) useAppStore.getState().newDoc()
}

export async function openFileFromDialog(): Promise<void> {
  if (!(await guardUnsaved())) return
  const file = await window.api.openFileDialog()
  if (file) useAppStore.getState().loadDoc(file)
}

/** Opening a folder only changes the sidebar tree, so it needs no guard. */
export async function openFolderFromDialog(): Promise<void> {
  const node = await window.api.openFolderDialog()
  if (node) useAppStore.getState().setRoot(node)
}

export async function openPath(path: string): Promise<void> {
  if (!(await guardUnsaved())) return
  const file = await window.api.readFile(path)
  useAppStore.getState().loadDoc(file)
}
