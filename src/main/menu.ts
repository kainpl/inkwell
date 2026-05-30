import { Menu, BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { IPC } from '../shared/ipc'

export function buildMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'
  const send = (channel: string) => () => win.webContents.send(channel)

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: send(IPC.menuNewFile) },
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: send(IPC.menuOpenFile) },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: send(IPC.menuOpenFolder) },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send(IPC.menuSave) },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: send(IPC.menuSaveAs) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: send(IPC.menuToggleSidebar) },
        { label: 'Toggle Outline', accelerator: 'CmdOrCtrl+/', click: send(IPC.menuToggleOutline) },
        {
          label: 'Toggle Focus Mode',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: send(IPC.menuToggleFocusMode)
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
