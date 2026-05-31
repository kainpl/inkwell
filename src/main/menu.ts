import { Menu, BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { IPC } from '../shared/ipc'

export function buildMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'
  const send = (channel: string) => () => win.webContents.send(channel)
  const fmt = (action: string) => () => win.webContents.send(IPC.menuFormat, action)

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
      label: 'Format',
      submenu: [
        { label: 'Bold', accelerator: 'CmdOrCtrl+B', click: fmt('bold') },
        { label: 'Italic', accelerator: 'CmdOrCtrl+I', click: fmt('italic') },
        { label: 'Strikethrough', click: fmt('strike') },
        { label: 'Inline Code', click: fmt('code') },
        { label: 'Highlight', click: fmt('highlight') },
        { type: 'separator' },
        { label: 'Heading 1', accelerator: 'CmdOrCtrl+1', click: fmt('h1') },
        { label: 'Heading 2', accelerator: 'CmdOrCtrl+2', click: fmt('h2') },
        { label: 'Heading 3', accelerator: 'CmdOrCtrl+3', click: fmt('h3') },
        { type: 'separator' },
        { label: 'Bullet List', click: fmt('ul') },
        { label: 'Numbered List', click: fmt('ol') },
        { label: 'Task List', click: fmt('task') },
        { label: 'Quote', click: fmt('quote') },
        { type: 'separator' },
        { label: 'Link', accelerator: 'CmdOrCtrl+K', click: fmt('link') },
        { label: 'Image', click: fmt('image') },
        { label: 'Table', accelerator: 'CmdOrCtrl+T', click: fmt('table') },
        { label: 'Code Block', click: fmt('codeblock') },
        { label: 'Horizontal Rule', click: fmt('hr') },
        { type: 'separator' },
        {
          label: 'Table',
          submenu: [
            { label: 'Insert Row Above', click: fmt('table:rowAbove') },
            { label: 'Insert Row Below', click: fmt('table:rowBelow') },
            { label: 'Delete Row', click: fmt('table:deleteRow') },
            { type: 'separator' },
            { label: 'Insert Column Before', click: fmt('table:colBefore') },
            { label: 'Insert Column After', click: fmt('table:colAfter') },
            { label: 'Delete Column', click: fmt('table:deleteCol') },
            { type: 'separator' },
            { label: 'Align Left', click: fmt('table:alignLeft') },
            { label: 'Align Center', click: fmt('table:alignCenter') },
            { label: 'Align Right', click: fmt('table:alignRight') }
          ]
        },
        { type: 'separator' },
        { label: 'Toggle Image Markdown/HTML', click: fmt('toggleImageSyntax') },
        { label: 'Upload Image', click: fmt('uploadImage') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Formatting Bar', accelerator: 'CmdOrCtrl+Shift+B', click: send(IPC.menuToggleFormatBar) },
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
