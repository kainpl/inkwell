import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IPC } from '../../shared/ipc'
import type { DocRef, OpenedInkproj } from '../../shared/mindmap/types'
import { openInkproj, readDocFile, saveInkproj, cleanupInkproj } from './zip'

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
  ipcMain.handle(IPC.inkprojSave, (_e, workingDir: string, schemaText: string, srcPath: string) =>
    saveInkproj(workingDir, schemaText, srcPath)
  )
  ipcMain.handle(IPC.inkprojClose, (_e, workingDir: string) => cleanupInkproj(workingDir))
}
