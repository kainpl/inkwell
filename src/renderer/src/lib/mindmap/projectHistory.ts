import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { getProjectDoc } from './yjsRegistry'
import { yjsToOutline } from './yjsModel'
import { outlineToMarkdown } from '@shared/mindmap/mindMapMarkdown'
import { projectVersionId } from './projectVersionId'

/** Idle delay before recording an edit-history snapshot (ms). */
export const PROJECT_HISTORY_DELAY = 4000

/**
 * Debounced **edit-history** recorder for project tabs: after the active dirty project
 * settles, snapshot its schema into the version store (the same one `saveProject` uses,
 * which dedups + caps at `MAX_VERSIONS`), so the history timeline fills *between* saves.
 * Independent of the `autoSave` flag — history records either way. Untitled projects
 * (no `projectVersionId`) aren't recorded. `delay`/`snapshot` are injectable for tests.
 */
export function startProjectHistory(
  delay: number = PROJECT_HISTORY_DELAY,
  snapshot: (id: string, schema: string) => void = (id, schema) =>
    void window.api.saveVersion(id, schema)
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
    const tab = s.tabs.find((t) => t.id === s.activeId)
    if (!tab || tab.kind !== 'project' || !tab.dirty) return
    timer = setTimeout(() => {
      const tabId = useAppStore.getState().activeId
      const pd = getProjectDoc(tabId)
      const entry = useProjectStore.getState().byTab[tabId]
      if (!pd || !entry) return
      const vid = projectVersionId(entry.srcPath)
      if (!vid) return // untitled — no stable id, no history yet
      const title = (pd.doc.getMap('meta').get('title') as string) ?? ''
      snapshot(vid, outlineToMarkdown(yjsToOutline(pd.doc), title))
    }, delay)
  })

  return () => {
    cancel()
    unsub()
  }
}
