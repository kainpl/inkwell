import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import { IPC } from '../../shared/ipc'
import type { DocRef } from '../../shared/mindmap/types'
import { openInkproj, readDocFile, cleanupInkproj } from './zip'

/** IPC for `.inkproj` mind-map/schema project files (open / read doc / close). */
export function registerInkprojIpc(): void {
  const base = join(app.getPath('userData'), 'inkproj-work')
  ipcMain.handle(IPC.inkprojOpen, (_e, srcPath: string) => openInkproj(srcPath, base))
  ipcMain.handle(IPC.inkprojReadDoc, (_e, workingDir: string, ref: DocRef) =>
    readDocFile(workingDir, ref)
  )
  ipcMain.handle(IPC.inkprojClose, (_e, workingDir: string) => cleanupInkproj(workingDir))
}
