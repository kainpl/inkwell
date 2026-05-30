import { app, shell, BrowserWindow, ipcMain, type IpcMainEvent } from 'electron'
import { join } from 'path'
import { registerFileIpc } from './ipc/files'
import { buildMenu } from './menu'
import { IPC } from '../shared/ipc'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 680,
    minHeight: 480,
    show: false,
    autoHideMenuBar: false,
    // A frameless-ish, content-first feel similar to Typora. Flip to your taste.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#faf9f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // --- Unsaved-changes guard: track dirty state and intercept window close ---
  let docDirty = false
  let allowClose = false
  const onDirty = (e: IpcMainEvent, dirty: boolean): void => {
    if (BrowserWindow.fromWebContents(e.sender) === win) docDirty = dirty
  }
  const onCloseWindow = (e: IpcMainEvent): void => {
    if (BrowserWindow.fromWebContents(e.sender) === win) {
      allowClose = true
      win.close()
    }
  }
  ipcMain.on(IPC.setDirty, onDirty)
  ipcMain.on(IPC.closeWindow, onCloseWindow)

  win.on('close', (e) => {
    // If the document is dirty, let the renderer run the guard first.
    if (allowClose || !docDirty) return
    e.preventDefault()
    win.webContents.send(IPC.tryClose)
  })
  win.on('closed', () => {
    ipcMain.removeListener(IPC.setDirty, onDirty)
    ipcMain.removeListener(IPC.closeWindow, onCloseWindow)
  })

  // electron-vite injects ELECTRON_RENDERER_URL in dev
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  registerFileIpc()

  const win = createWindow()
  buildMenu(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
