import { useAppStore } from '@renderer/store/useAppStore'
import { saveDoc } from './docActions'

/** Delay after the last edit before auto-saving (ms). */
export const AUTO_SAVE_DELAY = 1500

/**
 * Whether an auto-save should run for the given state. We only auto-save a
 * document that already has a path (a fresh "Untitled" must not pop a Save-As
 * dialog behind the user's back) and that has unsaved changes.
 */
export function shouldAutoSave(opts: {
  enabled: boolean
  dirty: boolean
  hasPath: boolean
}): boolean {
  return opts.enabled && opts.dirty && opts.hasPath
}

/**
 * Subscribe to the store and auto-save (debounced) after edits settle. Returns
 * an unsubscribe function. `delay` and `save` are injectable for testing.
 */
export function startAutoSave(
  delay: number = AUTO_SAVE_DELAY,
  save: () => void = () => void saveDoc()
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const unsub = useAppStore.subscribe((s) => {
    cancel()
    if (shouldAutoSave({ enabled: s.autoSave, dirty: s.doc.dirty, hasPath: s.doc.path !== null })) {
      timer = setTimeout(save, delay)
    }
  })

  return () => {
    cancel()
    unsub()
  }
}
