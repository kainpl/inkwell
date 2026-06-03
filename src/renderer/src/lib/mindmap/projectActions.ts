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
import { renderMarkdownBody } from '@renderer/lib/exportRender'
import { pdfOptions } from '@renderer/lib/pageSetup'
import { importAny, type ImportResult } from './importFormats'
import { importMindnode } from './importMindnode'
import { importXmind } from './importXmind'
import { toOpml, toPlainMarkdown, toFreeMind } from './exportFormats'
import { withRetry } from './retry'
import { projectVersionId } from './projectVersionId'

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

/** Create an untitled project (no path yet) → open it; first Save prompts save-as. */
export async function newUntitledProject(): Promise<void> {
  enterProject(await window.api.inkproj.createUntitled())
}

/** Parse a picked file (text or binary `.mindnode`/`.xmind`) into `{ title, outline }`. */
export async function importPicked(picked: {
  name: string
  text?: string
  base64?: string
}): Promise<ImportResult> {
  if (picked.base64) {
    const bytes = Uint8Array.from(atob(picked.base64), (c) => c.charCodeAt(0))
    return picked.name.toLowerCase().endsWith('.xmind')
      ? importXmind(bytes)
      : importMindnode(bytes)
  }
  return importAny(picked.name, picked.text ?? '')
}

/** Import a mind map from many formats (.mind-map/.mind-doc/.mm/.opml/.md/.txt/.json/.xmind/.mindnode)
 *  → convert to our schema → new `.inkproj` → open it (D11). */
export async function importMindMap(): Promise<void> {
  const picked = await window.api.inkproj.pickImportFile()
  if (!picked) return
  const { title, outline } = await importPicked(picked)
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

/** Export the active project's live schema → OPML / plain Markdown / FreeMind `.mm`. */
export async function exportAs(kind: 'opml' | 'md' | 'mm'): Promise<void> {
  const tabId = useAppStore.getState().activeId
  const pd = getProjectDoc(tabId)
  if (!pd) return
  const title = ((pd.doc.getMap('meta').get('title') as string) ?? '') || 'mindmap'
  const outline = yjsToOutline(pd.doc)
  const { text, name } =
    kind === 'opml'
      ? { text: toOpml(title, outline), name: `${title}.opml` }
      : kind === 'mm'
        ? { text: toFreeMind(title, outline), name: `${title}.mm` }
        : { text: toPlainMarkdown(outline, title), name: `${title}.md` }
  await window.api.inkproj.exportText(text, name)
}

/** Build the self-contained project HTML (tree + cross-links + rendered docs + inlined
 *  assets) once; reused by Export HTML / PDF / PNG / Print. Null if no active project. */
async function buildProjectHtml(interactive = false): Promise<{ html: string; title: string } | null> {
  const tabId = useAppStore.getState().activeId
  const entry = useProjectStore.getState().byTab[tabId]
  const pd = getProjectDoc(tabId)
  if (!entry || !pd) return null
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

  // Inline any `assets/…` images referenced in the docs (base64 → self-contained).
  const assetPaths = new Set<string>()
  for (const d of Object.values(docs)) {
    for (const it of d.items) {
      for (const m of it.content.matchAll(/!\[[^\]]*\]\((assets\/[^)\s]+)\)/g)) assetPaths.add(m[1])
    }
  }
  const assets: Record<string, string> = {}
  for (const p of assetPaths) {
    try {
      assets[p] = await window.api.inkproj.readAssetDataUri(entry.workingDir, p)
    } catch {
      /* skip a missing/oversized asset */
    }
  }

  const features = useAppStore.getState().markdownFeatures
  const html = renderProjectHtml({
    title,
    graph,
    linkTypes: entry.linkTypes,
    docs,
    assets,
    renderMd: (m) => renderMarkdownBody(m, features),
    interactive
  })
  return { html, title }
}

/** Export the active project → a single self-contained `.html` (tree + cross-links + docs). */
export async function exportHtml(): Promise<void> {
  const built = await buildProjectHtml()
  if (built) await window.api.inkproj.exportHtml(built.html, `${built.title}.html`)
}

/** Export the active project → an **interactive** `.html` (branches fold in the browser). */
export async function exportInteractiveHtml(): Promise<void> {
  const built = await buildProjectHtml(true)
  if (built) await window.api.inkproj.exportHtml(built.html, `${built.title}.html`)
}

/** Export the active project → PDF (the same HTML, printed via the offscreen window). */
export async function exportProjectPdf(): Promise<void> {
  const built = await buildProjectHtml()
  if (built) {
    await window.api.exportPdf(built.html, pdfOptions(useAppStore.getState().pageSetup), `${built.title}.pdf`)
  }
}

/** Export the active project → a full-page PNG (the same HTML, captured offscreen). */
export async function exportProjectImage(): Promise<void> {
  const built = await buildProjectHtml()
  if (built) await window.api.exportImage(built.html, `${built.title}.png`)
}

/** Print the active project (the same HTML, in the print-preview window). */
export async function printProject(): Promise<void> {
  const built = await buildProjectHtml()
  if (built) await window.api.printDoc(built.html, pdfOptions(useAppStore.getState().pageSetup))
}

/** Open a `.inkproj` from a known path (file association / double-click / a node link).
 *  Restricted to `.inkproj` so a document-sourced path can't read an arbitrary file. */
export async function openProjectFromPath(path: string): Promise<void> {
  if (!/\.inkproj$/i.test(path)) return
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
    payload.manifest = {
      ...entry.manifest,
      linkTypes: entry.manifestLinkTypes,
      instructions: entry.manifestInstructions || undefined
    }
  }
  const docs = Object.entries(entry.dirtyDocs).map(([path, content]) => ({ path, content }))
  if (docs.length) payload.docs = docs

  try {
    if (!entry.srcPath) {
      // Untitled project: prompt for a destination on the first save.
      const newPath = await withRetry(() => window.api.inkproj.saveAs(entry.workingDir, payload))
      if (!newPath) return // user cancelled — keep the tab dirty
      useProjectStore.getState().setSrcPath(newPath)
    } else {
      await withRetry(() => window.api.inkproj.save(entry.workingDir, payload, entry.srcPath))
    }
  } catch (e) {
    useProjectStore.getState().setSaveError(e instanceof Error ? e.message : String(e))
    throw e
  }
  useProjectStore.getState().setSaveError(null)
  useProjectStore.getState().clearManifestDirty()
  useProjectStore.getState().clearDirtyDocs()
  useProjectStore.getState().setSavedNodeCount(nodesOf(pd.doc).size)
  useAppStore.getState().setTabDirty(tabId, false)

  // Snapshot the schema into the local version history (dedup + prune handled by the
  // store). Reuses the markdown editor's version IPC; untitled (no path) isn't versioned.
  const vid = projectVersionId(useProjectStore.getState().byTab[tabId]?.srcPath ?? '')
  if (vid) void window.api.saveVersion(vid, payload.schema)
}

/** Restore a schema snapshot non-destructively: open it as a new untitled project. */
export async function restoreSchemaAsUntitled(schema: string): Promise<void> {
  enterProject(await window.api.inkproj.createUntitled(schema))
}

/** Tear down a project tab's runtime state, Yjs doc, and extracted working dir. */
export async function cleanupProjectTab(tabId: string): Promise<void> {
  const wd = useProjectStore.getState().byTab[tabId]?.workingDir
  useProjectStore.getState().removeProjectForTab(tabId)
  destroyProjectDoc(tabId)
  if (wd) await window.api.inkproj.close(wd)
}
