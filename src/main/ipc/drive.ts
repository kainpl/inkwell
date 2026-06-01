import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/ipc'
import { drive } from '../drive'

/**
 * IPC bridge for the Drive service. Handlers delegate to the singleton service;
 * connect/disconnect also broadcast `driveAccountsChanged` so the renderer can
 * refresh its account list. Rejections propagate to the renderer's `invoke`.
 */
export function registerDriveIpc(): void {
  ipcMain.handle(IPC.driveListAccounts, () => drive.list())

  ipcMain.handle(IPC.driveConnect, async (e) => {
    const account = await drive.connect()
    BrowserWindow.fromWebContents(e.sender)?.webContents.send(IPC.driveAccountsChanged)
    return account
  })

  ipcMain.handle(IPC.driveDisconnect, async (e, accountId: string) => {
    await drive.disconnect(accountId)
    BrowserWindow.fromWebContents(e.sender)?.webContents.send(IPC.driveAccountsChanged)
  })

  ipcMain.handle(IPC.driveList, (_e, accountId: string, folderId: string) =>
    drive.listFolder(accountId, folderId)
  )
  ipcMain.handle(IPC.driveRead, (_e, accountId: string, fileId: string) => drive.read(accountId, fileId))
  ipcMain.handle(
    IPC.driveWrite,
    (_e, accountId: string, fileId: string, content: string, base: string) =>
      drive.write(accountId, fileId, content, base)
  )
  ipcMain.handle(
    IPC.driveCreate,
    (_e, accountId: string, parentId: string, name: string, content: string) =>
      drive.create(accountId, parentId, name, content)
  )
  ipcMain.handle(IPC.driveSetClientId, (_e, id: string | null) => drive.setClientId(id))
}
