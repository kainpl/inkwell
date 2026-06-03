import type { Doc as YDoc } from 'yjs'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { markdownToOutline, outlineToMarkdown } from '@shared/mindmap/mindMapMarkdown'
import type { InkprojSavePayload, OpenedInkproj } from '@shared/mindmap/types'
import { createProjectDoc, destroyProjectDoc, getProjectDoc } from './yjsRegistry'
import { nodesOf, yjsToOutline } from './yjsModel'
import { mergeLinkTypes } from './linkTypes'

/** Ids whose subtree should start collapsed (`data.expand === false`). */
function initialCollapsed(doc: YDoc): Set<string> {
  const out = new Set<string>()
  nodesOf(doc).forEach((m, id) => {
    const data = JSON.parse((m.get('dataJson') as string) || '{}') as { expand?: unknown }
    if (data.expand === false) out.add(id)
  })
  return out
}

/** Parse an opened bundle, seed a Yjs doc, and open it as a new project tab. */
function enterProject(opened: OpenedInkproj): void {
  const { outline, title } = markdownToOutline(opened.schema)
  const docTitle = (opened.manifest.title ?? title ?? '').toString()
  const name = docTitle.trim() || 'Project'
  const tabId = useAppStore.getState().openProjectTab(name)
  const { doc } = createProjectDoc(tabId, outline, docTitle, opened.srcPath)
  useProjectStore.getState().setProjectForTab(tabId, {
    workingDir: opened.workingDir,
    manifest: opened.manifest,
    linkTypes: mergeLinkTypes(opened.manifest.linkTypes),
    srcPath: opened.srcPath,
    collapsed: initialCollapsed(doc)
  })
}

/** Open a `.inkproj` via the OS dialog → new project tab. */
export async function openProjectFromDialog(): Promise<void> {
  const opened = await window.api.inkproj.openDialog()
  if (opened) enterProject(opened)
}

/** Create a fresh `.inkproj` (pick its path) → open it as a project tab. */
export async function newProject(): Promise<void> {
  const opened = await window.api.inkproj.createDialog()
  if (opened) enterProject(opened)
}

/** Import a standalone `.mind-map` → a new `.inkproj` → open it (D11). */
export async function importMindMap(): Promise<void> {
  const opened = await window.api.inkproj.importDialog()
  if (opened) enterProject(opened)
}

/** Export the active project's live schema → a standalone `.mind-map` (D11). */
export async function exportMindMap(): Promise<void> {
  const tabId = useAppStore.getState().activeId
  const entry = useProjectStore.getState().byTab[tabId]
  const pd = getProjectDoc(tabId)
  if (!entry || !pd) return
  const title = (pd.doc.getMap('meta').get('title') as string) ?? ''
  const schema = outlineToMarkdown(yjsToOutline(pd.doc), title)
  await window.api.inkproj.exportMindMap(schema, `${title || 'mindmap'}.mind-map`)
}

/** Open a `.inkproj` from a known path (file association / double-click). */
export async function openProjectFromPath(path: string): Promise<void> {
  enterProject(await window.api.inkproj.open(path))
}

/** Serialize the project (schema + dirty manifest) back to `.inkproj` and clear dirty. */
export async function saveProject(tabId: string): Promise<void> {
  const entry = useProjectStore.getState().byTab[tabId]
  const pd = getProjectDoc(tabId)
  if (!entry || !pd) return
  const title = (pd.doc.getMap('meta').get('title') as string) ?? ''
  const payload: InkprojSavePayload = { schema: outlineToMarkdown(yjsToOutline(pd.doc), title) }
  if (entry.manifestDirty) {
    payload.manifest = { ...entry.manifest, linkTypes: entry.manifestLinkTypes }
  }
  const docs = Object.entries(entry.dirtyDocs).map(([path, content]) => ({ path, content }))
  if (docs.length) payload.docs = docs
  await window.api.inkproj.save(entry.workingDir, payload, entry.srcPath)
  useProjectStore.getState().clearManifestDirty()
  useProjectStore.getState().clearDirtyDocs()
  useAppStore.getState().setTabDirty(tabId, false)
}

/** Tear down a project tab's runtime state, Yjs doc, and extracted working dir. */
export async function cleanupProjectTab(tabId: string): Promise<void> {
  const wd = useProjectStore.getState().byTab[tabId]?.workingDir
  useProjectStore.getState().removeProjectForTab(tabId)
  destroyProjectDoc(tabId)
  if (wd) await window.api.inkproj.close(wd)
}
