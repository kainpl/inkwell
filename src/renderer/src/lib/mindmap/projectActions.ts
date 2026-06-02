import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import type { OpenedInkproj } from '@shared/mindmap/types'
import { buildGraph } from './buildGraph'
import { mergeLinkTypes } from './linkTypes'

/** Parse an opened bundle and open it as a new project tab. */
function enterProject(opened: OpenedInkproj): void {
  const graph = buildGraph(markdownToOutline(opened.schema).outline)
  const linkTypes = mergeLinkTypes(opened.manifest.linkTypes)
  const name = opened.manifest.title?.trim() || 'Project'
  const tabId = useAppStore.getState().openProjectTab(name)
  useProjectStore.getState().setProjectForTab(tabId, {
    workingDir: opened.workingDir,
    manifest: opened.manifest,
    graph,
    linkTypes
  })
}

/** Open a `.inkproj` via the OS dialog → new project tab. */
export async function openProjectFromDialog(): Promise<void> {
  const opened = await window.api.inkproj.openDialog()
  if (opened) enterProject(opened)
}

/** Open a `.inkproj` from a known path (file association / double-click). */
export async function openProjectFromPath(path: string): Promise<void> {
  enterProject(await window.api.inkproj.open(path))
}

/** Tear down a project tab's runtime state + extracted working dir (on tab close). */
export async function cleanupProjectTab(tabId: string): Promise<void> {
  const wd = useProjectStore.getState().byTab[tabId]?.workingDir
  useProjectStore.getState().removeProjectForTab(tabId)
  if (wd) await window.api.inkproj.close(wd)
}
