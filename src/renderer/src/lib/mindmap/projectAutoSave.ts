import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { getProjectDoc } from './yjsRegistry'
import { nodesOf } from './yjsModel'
import { saveProject } from './projectActions'
import { isCatastrophicShrink } from './saveGuard'

/** Delay after the last project edit before auto-saving (ms). */
export const PROJECT_AUTO_SAVE_DELAY = 1500

/**
 * Debounced autosave for project tabs, mirroring the markdown editor's
 * `startAutoSave`: gated on the global `autoSave` flag, only the *active* project
 * tab, only when dirty. A catastrophic node-count drop (vs the last save) is
 * **skipped** by the shrink-guard so a bug can't auto-overwrite a map with a stub
 * — the user can still resolve it with an explicit Save. `delay`/`save` injectable.
 */
export function startProjectAutoSave(
  delay: number = PROJECT_AUTO_SAVE_DELAY,
  save: (tabId: string) => void = (id) => void saveProject(id)
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
    if (!s.autoSave) return
    const tab = s.tabs.find((t) => t.id === s.activeId)
    if (!tab || tab.kind !== 'project' || !tab.dirty) return
    timer = setTimeout(() => {
      const tabId = useAppStore.getState().activeId
      const pd = getProjectDoc(tabId)
      const entry = useProjectStore.getState().byTab[tabId]
      if (!pd || !entry) return
      const count = nodesOf(pd.doc).size
      if (isCatastrophicShrink(entry.savedNodeCount, count)) {
        console.warn(
          `[inkwell] project autosave skipped — node count ${entry.savedNodeCount} → ${count} (shrink-guard); use Save to override`
        )
        return
      }
      save(tabId)
    }, delay)
  })

  return () => {
    cancel()
    unsub()
  }
}
