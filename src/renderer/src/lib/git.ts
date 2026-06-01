import { useAppStore } from '@renderer/store/useAppStore'

/**
 * Git status for the file tree. `refreshGitStatus` fetches the open folder's
 * status into the store; `startGitSync` re-fetches whenever the open folder
 * changes (and it is also called after a save).
 */

export async function refreshGitStatus(): Promise<void> {
  const root = useAppStore.getState().root
  const status = root ? await window.api.gitStatus(root.path).catch(() => null) : null
  useAppStore.getState().setGitStatus(status ?? {})
}

/** Re-fetch git status when the open folder changes. Returns an unsubscribe fn. */
export function startGitSync(): () => void {
  let lastRoot = useAppStore.getState().root?.path
  void refreshGitStatus()
  return useAppStore.subscribe(() => {
    const root = useAppStore.getState().root?.path
    if (root !== lastRoot) {
      lastRoot = root
      void refreshGitStatus()
    }
  })
}
