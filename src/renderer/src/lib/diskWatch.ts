import { useAppStore } from '@renderer/store/useAppStore'
import { useConfirm } from '@renderer/store/useConfirm'
import { isGdrive } from '@shared/drive'

/** Drive docs have no on-disk file to watch — never point the fs watcher at them. */
const watchable = (p: string | null): string | null => (isGdrive(p) ? null : p)

/**
 * Watch the open document for changes made by other programs. The main process
 * does the OS-level watching (and filters out our own saves); here we react to
 * its events: silently reload when we have no unsaved edits, otherwise ask.
 */

export type ExternalChangeAction = 'ignore' | 'reload' | 'prompt'

/**
 * Decide what to do when the file changed on disk. Pure so it can be tested:
 * identical content is a no-op (e.g. a stale/echo event); a clean buffer is
 * safe to reload; a dirty buffer needs the user to choose.
 */
export function externalChangeAction(
  dirty: boolean,
  diskContent: string,
  currentContent: string
): ExternalChangeAction {
  if (diskContent === currentContent) return 'ignore'
  return dirty ? 'prompt' : 'reload'
}

/** Replace the buffer with what's on disk, keeping path/name and marking clean. */
function reloadFromDisk(content: string): void {
  const { doc, loadDoc } = useAppStore.getState()
  loadDoc({ path: doc.path, name: doc.name, content })
}

async function handleExternalChange(content: string): Promise<void> {
  const { doc } = useAppStore.getState()
  const action = externalChangeAction(doc.dirty, content, doc.content)
  if (action === 'ignore') return
  if (action === 'reload') {
    reloadFromDisk(content)
    return
  }
  const choice = await useConfirm.getState().ask({
    title: 'File changed on disk',
    message: `“${doc.name}” was changed by another program. Reload it and lose your unsaved changes, or keep editing yours?`,
    confirmLabel: 'Reload',
    discardLabel: 'Keep Mine'
  })
  if (choice === 'save') reloadFromDisk(content)
  // 'discard' / 'cancel' → keep the in-memory edits as they are.
}

/** The open file was deleted/moved: keep the buffer but mark it unsaved. */
function handleExternalRemoval(): void {
  const { doc } = useAppStore.getState()
  if (doc.path === null) return
  useAppStore.setState((s) => ({ doc: { ...s.doc, dirty: true } }))
}

/**
 * Keep the main-process watcher pointed at the current document, and wire its
 * change/removal events. Returns a cleanup function for the app's lifetime.
 */
export function startDiskWatch(): () => void {
  let watched: string | null = useAppStore.getState().doc.path
  void window.api.watchFile(watchable(watched))

  const unsub = useAppStore.subscribe((s) => {
    if (s.doc.path !== watched) {
      watched = s.doc.path
      void window.api.watchFile(watchable(watched))
    }
  })
  const offChanged = window.api.onFileChangedExternally((content) => {
    void handleExternalChange(content)
  })
  const offRemoved = window.api.onFileRemovedExternally(() => handleExternalRemoval())

  return () => {
    unsub()
    offChanged()
    offRemoved()
    void window.api.watchFile(null)
  }
}
