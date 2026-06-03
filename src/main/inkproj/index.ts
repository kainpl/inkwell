import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { IPC } from '../../shared/ipc'
import type {
  DocRef,
  InkprojSavePayload,
  OpenedInkproj,
  PickedExternal
} from '../../shared/mindmap/types'
import {
  openInkproj,
  readDocFile,
  saveInkproj,
  saveInkprojAs,
  attachDoc,
  attachAsset,
  readAssetDataUri,
  createInkproj,
  createUntitledInkproj,
  gcDocs,
  cleanupInkproj
} from './zip'

const MD_FILTER = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] }]
const IMAGE_FILTER = [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]
const INKPROJ_FILTER = [{ name: 'Inkwell Project', extensions: ['inkproj'] }]
const MINDMAP_FILTER = [{ name: 'Mind-map', extensions: ['mind-map', 'md', 'markdown'] }]
const HTML_FILTER = [{ name: 'HTML', extensions: ['html', 'htm'] }]
const EXPORT_TEXT_FILTERS: Record<string, { name: string; extensions: string[] }[]> = {
  '.opml': [{ name: 'OPML', extensions: ['opml'] }],
  '.md': [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  '.mm': [{ name: 'FreeMind', extensions: ['mm'] }]
}
const IMPORT_FILTER = [
  {
    name: 'Mind map',
    extensions: ['mind-map', 'mind-doc', 'mindnode', 'mm', 'opml', 'md', 'markdown', 'txt', 'json']
  }
]
const DEFAULT_SCHEMA = '# Untitled\n'

/** Show an open-file dialog parented to the sender's window; return the picked path. */
async function pickFile(
  e: Electron.IpcMainInvokeEvent,
  title: string,
  filters = MD_FILTER
): Promise<string | undefined> {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts = { title, properties: ['openFile' as const], filters }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return res.canceled ? undefined : res.filePaths.at(0)
}

/** Show a save-file dialog; return the chosen path. */
async function pickSave(
  e: Electron.IpcMainInvokeEvent,
  title: string,
  defaultPath: string,
  filters: { name: string; extensions: string[] }[]
): Promise<string | undefined> {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts = { title, defaultPath, filters }
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  return res.canceled ? undefined : res.filePath || undefined
}

/** IPC for `.inkproj` mind-map/schema project files (open / read doc / close). */
export function registerInkprojIpc(): void {
  const base = join(app.getPath('userData'), 'inkproj-work')

  ipcMain.handle(IPC.inkprojOpen, (_e, srcPath: string) => openInkproj(srcPath, base))

  ipcMain.handle(IPC.inkprojOpenDialog, async (e): Promise<OpenedInkproj | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts = {
      title: 'Open Inkwell Project',
      properties: ['openFile' as const],
      filters: [{ name: 'Inkwell Project', extensions: ['inkproj'] }]
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    const path = res.canceled ? undefined : res.filePaths.at(0)
    return path ? openInkproj(path, base) : null
  })

  ipcMain.handle(IPC.inkprojCreateDialog, async (e): Promise<OpenedInkproj | null> => {
    const dest = await pickSave(e, 'New Inkwell Project', 'Untitled.inkproj', INKPROJ_FILTER)
    return dest ? createInkproj(dest, DEFAULT_SCHEMA, 'Untitled', base) : null
  })

  // Untitled project: no source file yet; bound to a path on the first save-as.
  // An optional schema seeds it (used by version-restore).
  ipcMain.handle(IPC.inkprojCreateUntitled, (_e, schemaText?: string) =>
    createUntitledInkproj(schemaText && schemaText.trim() ? schemaText : DEFAULT_SCHEMA, 'Untitled', base)
  )
  ipcMain.handle(
    IPC.inkprojSaveAs,
    async (e, workingDir: string, payload: InkprojSavePayload): Promise<string | null> => {
      const dest = await pickSave(e, 'Save Project As', 'Untitled.inkproj', INKPROJ_FILTER)
      return dest ? saveInkprojAs(workingDir, payload, dest) : null
    }
  )

  // Import (D11): pick a source mind-map file → return its raw text for the
  // renderer to parse (XML/OPML need DOMParser). The renderer then calls
  // createFromImport with the converted .mind-map schema.
  ipcMain.handle(
    IPC.inkprojPickImportFile,
    async (e): Promise<{ name: string; text?: string; base64?: string } | null> => {
      const src = await pickFile(e, 'Import Mind Map', IMPORT_FILTER)
      if (!src) return null
      const name = basename(src)
      // .mindnode is a binary ZIP → return bytes for the renderer's protobuf reader.
      if (name.toLowerCase().endsWith('.mindnode')) {
        return { name, base64: (await readFile(src)).toString('base64') }
      }
      return { name, text: await readFile(src, 'utf8') }
    }
  )
  ipcMain.handle(
    IPC.inkprojCreateFromImport,
    async (e, schemaText: string, title: string): Promise<OpenedInkproj | null> => {
      const dest = await pickSave(e, 'Save Imported Project', `${title}.inkproj`, INKPROJ_FILTER)
      return dest ? createInkproj(dest, schemaText, title, base) : null
    }
  )

  // Export the active project's schema → a standalone .mind-map (one-way share).
  ipcMain.handle(IPC.inkprojExportMindMap, async (e, schemaText: string, suggestedName: string) => {
    const dest = await pickSave(e, 'Export Mind-map', suggestedName, MINDMAP_FILTER)
    if (!dest) return null
    await writeFile(dest, schemaText, 'utf8')
    return dest
  })

  // Export the active project → a single self-contained .html (renderer builds the markup).
  ipcMain.handle(IPC.inkprojExportHtml, async (e, html: string, suggestedName: string) => {
    const dest = await pickSave(e, 'Export as HTML', suggestedName, HTML_FILTER)
    if (!dest) return null
    await writeFile(dest, html, 'utf8')
    return dest
  })

  // Generic text export (OPML / Markdown / FreeMind …) — the renderer builds the
  // text; the save filter is inferred from the suggested name's extension.
  ipcMain.handle(IPC.inkprojExportText, async (e, text: string, suggestedName: string) => {
    const ext = extname(suggestedName).toLowerCase()
    const filters = EXPORT_TEXT_FILTERS[ext] ?? [{ name: 'All Files', extensions: ['*'] }]
    const dest = await pickSave(e, 'Export', suggestedName, filters)
    if (!dest) return null
    await writeFile(dest, text, 'utf8')
    return dest
  })

  ipcMain.handle(IPC.inkprojReadDoc, (_e, workingDir: string, ref: DocRef) =>
    readDocFile(workingDir, ref)
  )
  ipcMain.handle(
    IPC.inkprojSave,
    (_e, workingDir: string, payload: InkprojSavePayload, srcPath: string) =>
      saveInkproj(workingDir, payload, srcPath)
  )
  ipcMain.handle(IPC.inkprojAttachDoc, async (e, workingDir: string): Promise<DocRef | null> => {
    const picked = await pickFile(e, 'Attach Document')
    return picked ? attachDoc(workingDir, picked) : null
  })

  // External docs (D7): read ONLY the file the user just picked in the dialog —
  // never a stored `src`. `pickExternal` serves both attach-external and re-open.
  ipcMain.handle(IPC.inkprojPickExternal, async (e): Promise<PickedExternal | null> => {
    const picked = await pickFile(e, 'Open External Document')
    if (!picked) return null
    return { src: picked, content: await readFile(picked, 'utf8'), title: basename(picked, extname(picked)) }
  })

  // Internalize = copy a user-picked file into the bundle's docs/ (reuses attachDoc).
  ipcMain.handle(IPC.inkprojInternalize, async (e, workingDir: string): Promise<DocRef | null> => {
    const picked = await pickFile(e, 'Internalize Document')
    return picked ? attachDoc(workingDir, picked) : null
  })

  ipcMain.handle(IPC.inkprojAttachAsset, async (e, workingDir: string): Promise<string | null> => {
    const picked = await pickFile(e, 'Attach Image', IMAGE_FILTER)
    return picked ? attachAsset(workingDir, picked) : null
  })
  ipcMain.handle(IPC.inkprojReadAssetDataUri, (_e, workingDir: string, relPath: string) =>
    readAssetDataUri(workingDir, relPath)
  )

  ipcMain.handle(IPC.inkprojGcDocs, (_e, workingDir: string, keep: string[]) =>
    gcDocs(workingDir, keep)
  )

  // Cross-project link: pick another `.inkproj` (a user-driven file grant); we store
  // only its path on the node and open it through the normal open flow on click.
  ipcMain.handle(IPC.inkprojPickProjectFile, async (e): Promise<string | null> => {
    const picked = await pickFile(e, 'Link a Project', INKPROJ_FILTER)
    return picked ?? null
  })

  ipcMain.handle(IPC.inkprojClose, (_e, workingDir: string) => cleanupInkproj(workingDir))
}
