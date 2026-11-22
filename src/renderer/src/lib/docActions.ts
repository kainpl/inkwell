import { useAppStore } from '@renderer/store/useAppStore'
import { useConfirm } from '@renderer/store/useConfirm'
import type { RecentKind } from './recents'

/**
 * Document operations that may discard unsaved work, all funnelled through
 * `guardUnsaved()` so the user is never surprised. Used by the menu wiring
 * (App.tsx), the file tree, and the window-close handler.
 */

// Serialize writes so a slower old save cannot overwrite a newer one.
let pending: Promise<unknown> = Promise.resolve()

function enqueueSave(as: boolean, automatic = false): Promise<boolean> {
  const id = useAppStore.getState().documentId
  const run = async () => {
    const { doc, documentId, finalNewline, documentEol, autoSave } = useAppStore.getState()
    if (
      id !== documentId ||
      (automatic && (!autoSave || !doc.path || !doc.dirty || useConfirm.getState().open))
    )
      return false
    const text =
      finalNewline && !/[\r\n]$/.test(doc.content) ? doc.content + documentEol : doc.content
    let path = doc.path
    let name = doc.name
    if (as || !path) {
      const result = await window.api.saveFileAs(text)
      if (!result) return false
      path = result.path
      name = result.name
    } else if (!(await window.api.saveFile(path, text))) return false
    const state = useAppStore.getState()
    if (state.documentId !== id) return false
    // A final newline is a file serialization option. Keep the caret and undo history intact.
    state.markSaved(doc.content, path, name)
    return !useAppStore.getState().doc.dirty
  }
  const result = pending.then(run)
  pending = result.catch(() => false)
  return result
}
export const saveDoc = () => enqueueSave(false)
export const saveDocAs = () => enqueueSave(true)

export function installAutosave(onError: (error: unknown) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    clearTimeout(timer)
    const { autoSave, doc } = useAppStore.getState()
    if (autoSave && doc.path && doc.dirty && !useConfirm.getState().open)
      timer = setTimeout(() => {
        void enqueueSave(false, true).catch(onError)
      }, 900)
  }
  const unsubscribe = useAppStore.subscribe((s, p) => {
    if (s.doc !== p.doc || s.autoSave !== p.autoSave) schedule()
  })
  schedule()
  const unconfirm = useConfirm.subscribe((s) => {
    if (s.open) clearTimeout(timer)
    else if (s.lastChoice === 'cancel') schedule()
  })
  return () => {
    clearTimeout(timer)
    unsubscribe()
    unconfirm()
  }
}

/**
 * If the document has unsaved changes, ask the user. Returns true when it is
 * safe to proceed (changes saved or discarded), false to abort the operation.
 */
export async function guardUnsaved(): Promise<boolean> {
  await pending
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

export async function openPath(path: string, recent = false): Promise<void> {
  if (!(await guardUnsaved())) return
  if (recent) await window.api.restoreRecentAccess('files', path)
  const file = await window.api.readFile(path)
  useAppStore.getState().loadDoc(file)
}

export async function openRecent(kind: RecentKind, path: string): Promise<void> {
  if (kind === 'files') return openPath(path, true)
  await window.api.restoreRecentAccess(kind, path)
  useAppStore.getState().setRoot(await window.api.readFolder(path))
}
