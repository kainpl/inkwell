import { Menu, BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { IPC } from '../shared/ipc'

export function buildMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'
  const send = (channel: string) => () => win.webContents.send(channel)
  const fmt = (action: string) => () => win.webContents.send(IPC.menuFormat, action)
  const pandoc = (format: string) => () => win.webContents.send(IPC.menuExportPandoc, format)

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: send(IPC.menuNewFile) },
        { label: 'New from Template…', click: send(IPC.menuNewFromTemplate) },
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: send(IPC.menuOpenFile) },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: send(IPC.menuOpenFolder) },
        { label: 'Open Quickly…', accelerator: 'CmdOrCtrl+P', click: send(IPC.menuOpenQuickly) },
        { label: 'Open Recent…', click: send(IPC.menuOpenRecent) },
        {
          label: 'Reopen Closed File',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: send(IPC.menuReopenClosed)
        },
        { label: 'Connect Google Drive…', click: send(IPC.menuConnectDrive) },
        { type: 'separator' },
        { label: 'Close', click: send(IPC.menuClose) },
        { label: 'Close Folder', click: send(IPC.menuCloseFolder) },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send(IPC.menuSave) },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: send(IPC.menuSaveAs) },
        { label: 'Auto Save', type: 'checkbox', checked: false, click: send(IPC.menuToggleAutoSave) },
        {
          label: 'Line Endings',
          submenu: [
            { label: 'LF (Unix)', click: send(IPC.menuSetLineEndingLf) },
            { label: 'CRLF (Windows)', click: send(IPC.menuSetLineEndingCrlf) }
          ]
        },
        {
          label: 'Insert Final Newline on Save',
          type: 'checkbox',
          checked: true,
          click: send(IPC.menuToggleFinalNewline)
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            { label: 'HTML (with styles)…', click: send(IPC.menuExportHtml) },
            { label: 'HTML (without styles)…', click: send(IPC.menuExportHtmlPlain) },
            { label: 'PDF…', click: send(IPC.menuExportPdf) },
            { label: 'Image (PNG)…', click: send(IPC.menuExportImage) },
            { type: 'separator' },
            { label: 'Word (.docx)…', click: pandoc('docx') },
            { label: 'OpenDocument (.odt)…', click: pandoc('odt') },
            { label: 'Rich Text (.rtf)…', click: pandoc('rtf') },
            { label: 'EPUB (.epub)…', click: pandoc('epub') },
            { label: 'LaTeX (.tex)…', click: pandoc('latex') }
          ]
        },
        { label: 'Page Setup…', click: send(IPC.menuPageSetup) },
        { label: 'Print…', click: send(IPC.menuPrint) },
        { type: 'separator' },
        { label: 'Browse All Versions…', click: send(IPC.menuBrowseVersions) },
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
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Copy As',
          submenu: [
            { label: 'Markdown', click: send(IPC.menuCopyMarkdown) },
            { label: 'HTML', click: send(IPC.menuCopyHtml) },
            { label: 'Plain Text', click: send(IPC.menuCopyPlain) },
            { label: 'Image', click: send(IPC.menuCopyImage) }
          ]
        },
        { type: 'separator' },
        { label: 'Preferences…', accelerator: 'CmdOrCtrl+,', click: send(IPC.menuPreferences) }
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
        { label: 'Subscript', click: fmt('sub') },
        { label: 'Superscript', click: fmt('sup') },
        { type: 'separator' },
        { label: 'Heading 1', accelerator: 'CmdOrCtrl+1', click: fmt('h1') },
        { label: 'Heading 2', accelerator: 'CmdOrCtrl+2', click: fmt('h2') },
        { label: 'Heading 3', accelerator: 'CmdOrCtrl+3', click: fmt('h3') },
        { label: 'Heading 4', click: fmt('h4') },
        { label: 'Heading 5', click: fmt('h5') },
        { label: 'Heading 6', click: fmt('h6') },
        { type: 'separator' },
        { label: 'Bullet List', click: fmt('ul') },
        { label: 'Numbered List', click: fmt('ol') },
        { label: 'Task List', click: fmt('task') },
        { label: 'Quote', click: fmt('quote') },
        { type: 'separator' },
        { label: 'Link', accelerator: 'CmdOrCtrl+K', click: fmt('link') },
        { label: 'Insert Image…', click: fmt('image') },
        { label: 'Table', accelerator: 'CmdOrCtrl+T', click: fmt('table') },
        { label: 'Code Block', click: fmt('codeblock') },
        { label: 'Horizontal Rule', click: fmt('hr') },
        { type: 'separator' },
        { label: 'Footnote', click: fmt('footnote') },
        { label: 'Inline Math', click: fmt('mathInline') },
        { label: 'Math Block', click: fmt('mathBlock') },
        { label: 'Mermaid Diagram', click: fmt('mermaid') },
        { label: 'Table of Contents', click: fmt('toc') },
        {
          label: 'Alert',
          submenu: [
            { label: 'Note', click: fmt('alert:note') },
            { label: 'Tip', click: fmt('alert:tip') },
            { label: 'Important', click: fmt('alert:important') },
            { label: 'Warning', click: fmt('alert:warning') },
            { label: 'Caution', click: fmt('alert:caution') }
          ]
        },
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
        { label: 'Upload Image', click: fmt('uploadImage') },
        { type: 'separator' },
        { label: 'Clear Format', click: fmt('clearFormat') },
        { label: 'Prettify Source', click: fmt('prettify') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+Shift+P', click: send(IPC.menuCommandPalette) },
        { label: 'Note Graph…', click: send(IPC.menuNoteGraph) },
        { label: 'Source Control…', accelerator: 'CmdOrCtrl+Shift+G', click: send(IPC.menuSourceControl) },
        { type: 'separator' },
        { label: 'Toggle Formatting Bar', accelerator: 'CmdOrCtrl+Shift+B', click: send(IPC.menuToggleFormatBar) },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: send(IPC.menuToggleSidebar) },
        { label: 'Toggle Outline', accelerator: 'CmdOrCtrl+/', click: send(IPC.menuToggleOutline) },
        {
          label: 'Search in Folder…',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: send(IPC.menuGlobalSearch)
        },
        { type: 'separator' },
        {
          label: 'Toggle Focus Mode',
          accelerator: 'F8',
          click: send(IPC.menuToggleFocusMode)
        },
        {
          label: 'Toggle Typewriter Mode',
          accelerator: 'F9',
          click: send(IPC.menuToggleTypewriter)
        },
        {
          label: 'Toggle Source Code Mode',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: send(IPC.menuToggleSourceMode)
        },
        { type: 'separator' },
        { label: 'Start Speaking', click: send(IPC.menuStartSpeaking) },
        { label: 'Stop Speaking', click: send(IPC.menuStopSpeaking) },
        { type: 'separator' },
        { label: 'Jump to Top', accelerator: 'CmdOrCtrl+Home', click: send(IPC.menuJumpTop) },
        { label: 'Jump to Bottom', accelerator: 'CmdOrCtrl+End', click: send(IPC.menuJumpBottom) },
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: win.isAlwaysOnTop(),
          click: (item) => win.setAlwaysOnTop(item.checked)
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
