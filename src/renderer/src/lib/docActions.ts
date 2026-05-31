import { useAppStore } from '@renderer/store/useAppStore'
import { useConfirm } from '@renderer/store/useConfirm'
import {
  dropRecentFile,
  getRecentFiles,
  getSession,
  pushRecentFile,
  setSessionFile,
  setSessionFolder
} from './persistence'
import { normalizeForSave } from './saveOptions'
import { draftId, isRecoverable, newestDraft } from './drafts'

/** Content shaped for disk per the user's line-ending / final-newline settings. */
function contentForDisk(): string {
  const s = useAppStore.getState()
  return normalizeForSave(s.doc.content, {
    lineEnding: s.lineEnding,
    insertFinalNewline: s.insertFinalNewline
  })
}

/**
 * Document operations that may discard unsaved work, all funnelled through
 * `guardUnsaved()` so the user is never surprised. Used by the menu wiring
 * (App.tsx), the file tree, and the window-close handler.
 */

/** Record an opened/saved file in the recent list and the restorable session. */
function rememberFile(path: string): void {
  pushRecentFile(path)
  setSessionFile(path)
}

/** Append a snapshot to the document's local version history (best-effort). */
function snapshotVersion(path: string, content: string): void {
  void window.api.saveVersion(draftId(path), content)
}

/** Save to the current path, or fall back to Save As. Returns false if canceled. */
export async function saveDoc(): Promise<boolean> {
  const { doc, markSaved } = useAppStore.getState()
  if (doc.path) {
    const content = contentForDisk()
    await window.api.saveFile(doc.path, content)
    markSaved()
    snapshotVersion(doc.path, content)
    return true
  }
  return saveDocAs()
}

/** Save As via a native dialog. Returns false if the user cancels the dialog. */
export async function saveDocAs(): Promise<boolean> {
  const { markSaved } = useAppStore.getState()
  const content = contentForDisk()
  const result = await window.api.saveFileAs(content)
  if (!result) return false
  markSaved(result.path, result.name)
  rememberFile(result.path)
  snapshotVersion(result.path, content)
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
  if (file) {
    useAppStore.getState().loadDoc(file)
    rememberFile(file.path)
  }
}

/** Opening a folder only changes the sidebar tree, so it needs no guard. */
export async function openFolderFromDialog(): Promise<void> {
  const node = await window.api.openFolderDialog()
  if (node) {
    useAppStore.getState().setRoot(node)
    setSessionFolder(node.path)
  }
}

export async function openPath(path: string): Promise<void> {
  if (!(await guardUnsaved())) return
  const file = await window.api.readFile(path)
  useAppStore.getState().loadDoc(file)
  rememberFile(file.path)
}

/**
 * After session restore, offer to recover the newest crash-recovery draft whose
 * content differs from disk. Recovered content is loaded into the editor and
 * marked dirty so the user can Save or discard it. Run once on launch.
 */
export async function recoverDrafts(): Promise<void> {
  const drafts = await window.api.listDrafts()
  if (drafts.length === 0) return

  // Keep only drafts that still differ from what's on disk; prune the rest.
  const recoverable = []
  for (const d of drafts) {
    let disk: string | null = null
    if (d.docPath) {
      const file = await window.api.readFile(d.docPath).catch(() => null)
      disk = file ? file.content : null // file gone → draft still worth recovering
    }
    if (isRecoverable(d, disk)) recoverable.push(d)
    else void window.api.clearDraft(d.id)
  }

  const best = newestDraft(recoverable)
  if (!best) return

  const choice = await useConfirm.getState().ask({
    title: 'Recover unsaved draft?',
    message: `Inkwell found unsaved changes for “${best.name}” from a previous session. Recover them?`,
    confirmLabel: 'Recover',
    discardLabel: 'Discard'
  })
  if (choice === 'cancel') return // keep the draft, leave current doc as-is
  if (choice === 'discard') {
    void window.api.clearDraft(best.id)
    return
  }
  // "save" → load the recovered content (dirty) so the user can save it.
  useAppStore.getState().loadDoc({ path: best.docPath, name: best.name, content: best.content })
  useAppStore.setState((s) => ({ doc: { ...s.doc, dirty: true } }))
}

/**
 * Reopen the most recent file that isn't the current document. Drops entries
 * from the recent list if they can't be read (moved/deleted).
 */
export async function reopenClosedFile(): Promise<void> {
  const current = useAppStore.getState().doc.path
  for (const path of getRecentFiles()) {
    if (path === current) continue
    const file = await window.api.readFile(path).catch(() => null)
    if (file) {
      await openPath(path)
      return
    }
    dropRecentFile(path)
  }
}

/**
 * On launch, reopen the last session's folder and document if they still exist.
 * Failures (deleted/moved paths) are ignored so startup never breaks. Returns
 * true when a document was restored (so the caller can skip the welcome doc).
 */
export async function restoreSession(): Promise<boolean> {
  const { folderPath, filePath } = getSession()
  if (folderPath) {
    const node = await window.api.readFolder(folderPath).catch(() => null)
    if (node) useAppStore.getState().setRoot(node)
  }
  if (filePath) {
    const file = await window.api.readFile(filePath).catch(() => null)
    if (file) {
      useAppStore.getState().loadDoc(file)
      return true
    }
  }
  return false
}

/**
 * Load the bundled welcome document from disk (resources/Welcome.md). Shown on
 * first launch when there's no session to restore, and by the Close commands;
 * loaded path-less so editing it prompts Save As rather than overwriting the
 * shipped sample.
 */
export async function loadWelcome(): Promise<void> {
  const content = await window.api.getWelcome()
  useAppStore.getState().loadDoc({ path: null, name: 'Welcome.md', content })
}

/**
 * Close the current document (guarding unsaved changes) and return to the
 * welcome doc. The folder/sidebar stays open; the restorable session file is
 * cleared so a relaunch doesn't reopen it.
 */
export async function closeDocument(): Promise<void> {
  if (!(await guardUnsaved())) return
  setSessionFile(null)
  await loadWelcome()
}

/**
 * Close the open folder and document, returning to a fresh welcome state: the
 * sidebar tree is emptied and the whole restorable session (folder + file) is
 * cleared, so the next launch starts clean.
 */
export async function closeFolder(): Promise<void> {
  if (!(await guardUnsaved())) return
  useAppStore.getState().setRoot(null)
  setSessionFolder(null)
  setSessionFile(null)
  await loadWelcome()
}
