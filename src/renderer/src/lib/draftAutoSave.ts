import { useAppStore } from '@renderer/store/useAppStore'
import { draftId } from './drafts'

/** Delay after the last edit before snapshotting a recovery draft (ms). */
export const DRAFT_DELAY = 1000

/**
 * Subscribe to the store and snapshot a crash-recovery draft (debounced) while
 * the document is dirty; clear it once the document is clean. Returns an
 * unsubscribe function. `delay` is injectable for testing.
 */
export function startDraftAutoSave(delay: number = DRAFT_DELAY): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const unsub = useAppStore.subscribe((s) => {
    cancel()
    const { doc } = s
    // Project tabs are path-less and content-less; they own their own (.inkproj) save
    // path and must not generate crash-recovery drafts.
    if (s.tabs.find((t) => t.id === s.activeId)?.kind === 'project') return
    if (doc.dirty) {
      timer = setTimeout(() => {
        void window.api.saveDraft({
          id: draftId(doc.path),
          docPath: doc.path,
          name: doc.name,
          content: doc.content,
          savedAt: Date.now()
        })
      }, delay)
    } else if (doc.path !== null || doc.content === '') {
      // Clean save (or emptied untitled): the draft is no longer needed.
      void window.api.clearDraft(draftId(doc.path))
    }
  })

  return () => {
    cancel()
    unsub()
  }
}
