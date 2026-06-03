import type { Doc as YDoc } from 'yjs'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { markdownToOutline, outlineToMarkdown } from '@shared/mindmap/mindMapMarkdown'
import type { InkprojSavePayload, OpenedInkproj } from '@shared/mindmap/types'
import { createProjectDoc, destroyProjectDoc, getProjectDoc } from './yjsRegistry'
import { nodesOf, yjsToOutline } from './yjsModel'
import { mergeLinkTypes } from './linkTypes'
import { buildGraph } from './buildGraph'
import { renderProjectHtml, type HtmlDoc } from './exportHtml'
import { importAny } from './importFormats'

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

/** Import a mind map from many formats (.mind-map/.mind-doc/.mm/.opml/.md/.txt/.json)
 *  → convert to our schema → new `.inkproj` → open it (D11). */
export async function importMindMap(): Promise<void> {
  const picked = await window.api.inkproj.pickImportFile()
  if (!picked) return
  const { title, outline } = importAny(picked.name, picked.text)
  const schema = outlineToMarkdown(outline, title)
  const opened = await window.api.inkproj.createFromImport(schema, title || 'Imported')
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

/** Export the active project → a single self-contained `.html` (tree + cross-links + docs). */
export async function exportHtml(): Promise<void> {
  const tabId = useAppStore.getState().activeId
  const entry = useProjectStore.getState().byTab[tabId]
  const pd = getProjectDoc(tabId)
  if (!entry || !pd) return
  const title = ((pd.doc.getMap('meta').get('title') as string) ?? '') || 'Project'
  const graph = buildGraph(yjsToOutline(pd.doc))

  const docs: Record<string, HtmlDoc> = {}
  for (const node of graph.nodes) {
    const refs = (Array.isArray(node.data.docs) ? node.data.docs : []).filter(
      (r) => !r.external && r.path
    )
    const items: { title: string; content: string }[] = []
    for (const ref of refs) {
      try {
        const content = await window.api.inkproj.readDoc(entry.workingDir, ref)
        items.push({ title: ref.title ?? ref.path ?? 'Document', content })
      } catch {
        /* skip an unreadable doc */
      }
    }
    if (items.length) docs[node.id] = { label: node.label, items }
  }

  const html = renderProjectHtml({ title, graph, linkTypes: entry.linkTypes, docs })
  await window.api.inkproj.exportHtml(html, `${title}.html`)
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
