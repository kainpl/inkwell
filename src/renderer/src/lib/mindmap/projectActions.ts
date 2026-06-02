import { useProjectStore } from '@renderer/store/useProjectStore'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import type { OpenedInkproj } from '@shared/mindmap/types'
import { buildGraph } from './buildGraph'
import { mergeLinkTypes } from './linkTypes'

/** Parse an opened bundle into a graph + registry and enter project mode. */
function enterProject(opened: OpenedInkproj): void {
  const graph = buildGraph(markdownToOutline(opened.schema).outline)
  const linkTypes = mergeLinkTypes(opened.manifest.linkTypes)
  useProjectStore.getState().setProject({
    workingDir: opened.workingDir,
    manifest: opened.manifest,
    graph,
    linkTypes
  })
}

/** Open a `.inkproj` via the OS dialog → enter project mode. */
export async function openProjectFromDialog(): Promise<void> {
  const opened = await window.api.inkproj.openDialog()
  if (opened) enterProject(opened)
}

/** Open a `.inkproj` from a known path (file association / double-click). */
export async function openProjectFromPath(path: string): Promise<void> {
  enterProject(await window.api.inkproj.open(path))
}

/** Leave project mode and clean up the extracted working dir. */
export async function closeProject(): Promise<void> {
  const wd = useProjectStore.getState().workingDir
  useProjectStore.getState().closeProject()
  if (wd) await window.api.inkproj.close(wd)
}
