import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { readFile } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { IPC } from '../../shared/ipc'
import type {
  DocRef,
  InkprojSavePayload,
  OpenedInkproj,
  PickedExternal
} from '../../shared/mindmap/types'
import { openInkproj, readDocFile, saveInkproj, attachDoc, cleanupInkproj } from './zip'

const MD_FILTER = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] }]

/** Show an open-file dialog parented to the sender's window; return the picked path. */
async function pickFile(e: Electron.IpcMainInvokeEvent, title: string): Promise<string | undefined> {
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts = { title, properties: ['openFile' as const], filters: MD_FILTER }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return res.canceled ? undefined : res.filePaths.at(0)
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

  ipcMain.handle(IPC.inkprojClose, (_e, workingDir: string) => cleanupInkproj(workingDir))
}
