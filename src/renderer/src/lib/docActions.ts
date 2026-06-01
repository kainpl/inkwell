import { useAppStore } from '@renderer/store/useAppStore'
import { useConfirm } from '@renderer/store/useConfirm'
import {
  dropRecentFile,
  dropRecentFolder,
  getRecentFiles,
  getSession,
  pushRecentFile,
  pushRecentFolder,
  setSessionFolder
} from './persistence'
import { normalizeForSave } from './saveOptions'
import { draftId, isRecoverable, newestDraft } from './drafts'
import { refreshGitStatus } from './git'
import { isGdrive } from '@shared/drive'
import { readRef, writeRef } from './fileSource'
import { getDriveBase, setDriveBase } from './drive'

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

/** Record an opened/saved file in the recent list. (The restorable session file
 *  follows the active tab via a subscription in App.tsx.) */
function rememberFile(path: string): void {
  pushRecentFile(path)
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
    if (isGdrive(doc.path)) return saveDriveDoc(doc.path, content)
    await window.api.saveFile(doc.path, content)
    markSaved()
    snapshotVersion(doc.path, content)
    void refreshGitStatus()
    return true
  }
  return saveDocAs()
}

/** Upload a Drive-backed doc, guarding against a remote change since open. */
async function saveDriveDoc(path: string, content: string): Promise<boolean> {
  const res = await writeRef(path, content, getDriveBase(path))
  if (!res.ok) {
    const choice = await useConfirm.getState().ask({
      title: 'File changed on Drive',
      message:
        'This file was modified on Google Drive since you opened it. Overwrite it with your version?',
      confirmLabel: 'Overwrite',
      discardLabel: 'Cancel'
    })
    if (choice !== 'save') return false
    const forced = await writeRef(path, content, '') // empty base skips the conflict check
    if (!forced.ok) return false
    useAppStore.getState().markSaved()
    setDriveBase(path, forced.modifiedTime)
    return true
  }
  useAppStore.getState().markSaved()
  setDriveBase(path, res.modifiedTime)
  return true
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
  void refreshGitStatus()
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

/** New document = a new tab. Opening never discards work now, so no guard. */
export function newDocument(): void {
  useAppStore.getState().newTab()
}

/** Substitute template tokens (currently just `{date}`). Pure for testing. */
export function fillTemplate(content: string, date: string): string {
  return content.replace(/\{date\}/g, date)
}

/** Create a new untitled (dirty) document seeded with a template's content. */
export function newDocumentFromTemplate(content: string): void {
  const store = useAppStore.getState()
  store.newTab()
  store.setContent(fillTemplate(content, new Date().toLocaleDateString()))
}

export async function openFileFromDialog(): Promise<void> {
  const file = await window.api.openFileDialog()
  if (file) {
    useAppStore.getState().openInTab(file)
    rememberFile(file.path)
  }
}

/** Opening a folder only changes the sidebar tree, so it needs no guard. */
export async function openFolderFromDialog(): Promise<void> {
  const node = await window.api.openFolderDialog()
  if (node) {
    useAppStore.getState().setRoot(node)
    setSessionFolder(node.path)
    pushRecentFolder(node.path)
  }
}

/** Open a workspace folder by path (recent-folders picker / start screen). A
 *  path that no longer exists is dropped from the recent list. */
export async function openFolderByPath(path: string): Promise<void> {
  const node = await window.api.readFolder(path).catch(() => null)
  if (!node) {
    dropRecentFolder(path)
    return
  }
  useAppStore.getState().setRoot(node)
  setSessionFolder(node.path)
  pushRecentFolder(node.path)
}

/** Open a file path in a tab (focuses an existing tab for it, if any). Handles
 *  both local paths and `gdrive://` Drive refs. */
export async function openPath(path: string): Promise<void> {
  if (isGdrive(path)) {
    const { content, name, modifiedTime } = await readRef(path)
    setDriveBase(path, modifiedTime)
    useAppStore.getState().openInTab({ path, name, content })
    return
  }
  const file = await window.api.readFile(path)
  useAppStore.getState().openInTab(file)
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
 * Reopen the most recent file that isn't already open in a tab. Drops entries
 * from the recent list if they can't be read (moved/deleted).
 */
export async function reopenClosedFile(): Promise<void> {
  const open = new Set(useAppStore.getState().tabs.map((t) => t.path))
  for (const path of getRecentFiles()) {
    if (open.has(path)) continue
    const file = await window.api.readFile(path).catch(() => null)
    if (file) {
      useAppStore.getState().openInTab(file)
      rememberFile(path)
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
    if (node) {
      useAppStore.getState().setRoot(node)
      pushRecentFolder(node.path)
    }
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
 * Run the unsaved-changes guard across every dirty tab (activating each so the
 * user sees which one). Returns false as soon as the user cancels. Used by the
 * window-close handler and Close Folder.
 */
export async function guardAllTabs(): Promise<boolean> {
  for (const tab of useAppStore.getState().tabs) {
    if (!tab.dirty) continue
    useAppStore.getState().activateTab(tab.id)
    if (!(await guardUnsaved())) return false
  }
  return true
}

/**
 * Close a single tab (the × button or File → Close), guarding unsaved changes.
 * Closing the last tab returns to the welcome doc.
 */
export async function closeTabById(id: string): Promise<void> {
  const tab = useAppStore.getState().tabs.find((t) => t.id === id)
  if (!tab) return
  if (tab.dirty) {
    useAppStore.getState().activateTab(id)
    if (!(await guardUnsaved())) return
  }
  const wasLast = useAppStore.getState().tabs.length === 1
  useAppStore.getState().removeTab(id)
  if (wasLast) await loadWelcome()
}

/** File → Close: close the active tab. */
export function closeDocument(): Promise<void> {
  return closeTabById(useAppStore.getState().activeId)
}

/**
 * Close the open folder and all tabs, returning to a fresh welcome state: the
 * sidebar tree is emptied and the session folder cleared, so the next launch
 * starts clean. Guards every dirty tab first.
 */
export async function closeFolder(): Promise<void> {
  if (!(await guardAllTabs())) return
  useAppStore.getState().setRoot(null)
  setSessionFolder(null)
  useAppStore.getState().resetTabs()
  await loadWelcome()
}
