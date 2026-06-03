import { Menu, BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { IPC } from '../shared/ipc'
import { translate, type Locale } from '../shared/i18n'

export function buildMenu(win: BrowserWindow, locale: Locale): void {
  const isMac = process.platform === 'darwin'
  const t = (key: string): string => translate(locale, key)
  const send = (channel: string) => () => win.webContents.send(channel)
  const fmt = (action: string) => () => win.webContents.send(IPC.menuFormat, action)
  const pandoc = (format: string) => () => win.webContents.send(IPC.menuExportPandoc, format)

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: t('menu.file'),
      submenu: [
        { label: t('file.new'), accelerator: 'CmdOrCtrl+N', click: send(IPC.menuNewFile) },
        { label: t('file.newFromTemplate'), click: send(IPC.menuNewFromTemplate) },
        { label: t('file.openFile'), accelerator: 'CmdOrCtrl+O', click: send(IPC.menuOpenFile) },
        { label: t('file.newProject'), click: send(IPC.menuNewProject) },
        { label: t('file.openProject'), click: send(IPC.menuOpenProject) },
        { label: t('file.importMindMap'), click: send(IPC.menuImportMindMap) },
        { label: t('file.exportMindMap'), click: send(IPC.menuExportMindMap) },
        { label: t('file.openFolder'), accelerator: 'CmdOrCtrl+Shift+O', click: send(IPC.menuOpenFolder) },
        { label: t('file.openQuickly'), accelerator: 'CmdOrCtrl+P', click: send(IPC.menuOpenQuickly) },
        { label: t('file.openRecent'), click: send(IPC.menuOpenRecent) },
        {
          label: t('file.reopenClosed'),
          accelerator: 'CmdOrCtrl+Shift+T',
          click: send(IPC.menuReopenClosed)
        },
        { label: t('file.connectDrive'), click: send(IPC.menuConnectDrive) },
        { type: 'separator' },
        { label: t('file.close'), click: send(IPC.menuClose) },
        { label: t('file.closeFolder'), click: send(IPC.menuCloseFolder) },
        { type: 'separator' },
        { label: t('file.save'), accelerator: 'CmdOrCtrl+S', click: send(IPC.menuSave) },
        { label: t('file.saveAs'), accelerator: 'CmdOrCtrl+Shift+S', click: send(IPC.menuSaveAs) },
        { label: t('file.autoSave'), type: 'checkbox', checked: false, click: send(IPC.menuToggleAutoSave) },
        {
          label: t('file.lineEndings'),
          submenu: [
            { label: t('file.lf'), click: send(IPC.menuSetLineEndingLf) },
            { label: t('file.crlf'), click: send(IPC.menuSetLineEndingCrlf) }
          ]
        },
        {
          label: t('file.finalNewline'),
          type: 'checkbox',
          checked: true,
          click: send(IPC.menuToggleFinalNewline)
        },
        { type: 'separator' },
        {
          label: t('file.export'),
          submenu: [
            { label: t('export.htmlStyled'), click: send(IPC.menuExportHtml) },
            { label: t('export.htmlPlain'), click: send(IPC.menuExportHtmlPlain) },
            { label: t('export.pdf'), click: send(IPC.menuExportPdf) },
            { label: t('export.image'), click: send(IPC.menuExportImage) },
            { type: 'separator' },
            { label: t('export.docx'), click: pandoc('docx') },
            { label: t('export.odt'), click: pandoc('odt') },
            { label: t('export.rtf'), click: pandoc('rtf') },
            { label: t('export.epub'), click: pandoc('epub') },
            { label: t('export.latex'), click: pandoc('latex') }
          ]
        },
        { label: t('file.pageSetup'), click: send(IPC.menuPageSetup) },
        { label: t('file.print'), click: send(IPC.menuPrint) },
        { type: 'separator' },
        { label: t('file.browseVersions'), click: send(IPC.menuBrowseVersions) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: t('menu.edit'),
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
          label: t('edit.copyAs'),
          submenu: [
            { label: t('edit.copyMarkdown'), click: send(IPC.menuCopyMarkdown) },
            { label: t('edit.copyHtml'), click: send(IPC.menuCopyHtml) },
            { label: t('edit.copyPlain'), click: send(IPC.menuCopyPlain) },
            { label: t('edit.copyImage'), click: send(IPC.menuCopyImage) }
          ]
        },
        { type: 'separator' },
        { label: t('edit.preferences'), accelerator: 'CmdOrCtrl+,', click: send(IPC.menuPreferences) }
      ]
    },
    {
      label: t('menu.format'),
      submenu: [
        { label: t('format.bold'), accelerator: 'CmdOrCtrl+B', click: fmt('bold') },
        { label: t('format.italic'), accelerator: 'CmdOrCtrl+I', click: fmt('italic') },
        { label: t('format.strike'), click: fmt('strike') },
        { label: t('format.code'), click: fmt('code') },
        { label: t('format.highlight'), click: fmt('highlight') },
        { label: t('format.sub'), click: fmt('sub') },
        { label: t('format.sup'), click: fmt('sup') },
        { type: 'separator' },
        { label: t('format.h1'), accelerator: 'CmdOrCtrl+1', click: fmt('h1') },
        { label: t('format.h2'), accelerator: 'CmdOrCtrl+2', click: fmt('h2') },
        { label: t('format.h3'), accelerator: 'CmdOrCtrl+3', click: fmt('h3') },
        { label: t('format.h4'), click: fmt('h4') },
        { label: t('format.h5'), click: fmt('h5') },
        { label: t('format.h6'), click: fmt('h6') },
        { type: 'separator' },
        { label: t('format.ul'), click: fmt('ul') },
        { label: t('format.ol'), click: fmt('ol') },
        { label: t('format.task'), click: fmt('task') },
        { label: t('format.quote'), click: fmt('quote') },
        { type: 'separator' },
        { label: t('format.link'), accelerator: 'CmdOrCtrl+K', click: fmt('link') },
        { label: t('format.image'), click: fmt('image') },
        { label: t('format.table'), accelerator: 'CmdOrCtrl+T', click: fmt('table') },
        { label: t('format.codeblock'), click: fmt('codeblock') },
        { label: t('format.hr'), click: fmt('hr') },
        { type: 'separator' },
        { label: t('format.footnote'), click: fmt('footnote') },
        { label: t('format.mathInline'), click: fmt('mathInline') },
        { label: t('format.mathBlock'), click: fmt('mathBlock') },
        { label: t('format.mermaid'), click: fmt('mermaid') },
        { label: t('format.toc'), click: fmt('toc') },
        {
          label: t('format.alert'),
          submenu: [
            { label: t('alert.note'), click: fmt('alert:note') },
            { label: t('alert.tip'), click: fmt('alert:tip') },
            { label: t('alert.important'), click: fmt('alert:important') },
            { label: t('alert.warning'), click: fmt('alert:warning') },
            { label: t('alert.caution'), click: fmt('alert:caution') }
          ]
        },
        { type: 'separator' },
        {
          label: t('format.table'),
          submenu: [
            { label: t('table.rowAbove'), click: fmt('table:rowAbove') },
            { label: t('table.rowBelow'), click: fmt('table:rowBelow') },
            { label: t('table.deleteRow'), click: fmt('table:deleteRow') },
            { type: 'separator' },
            { label: t('table.colBefore'), click: fmt('table:colBefore') },
            { label: t('table.colAfter'), click: fmt('table:colAfter') },
            { label: t('table.deleteCol'), click: fmt('table:deleteCol') },
            { type: 'separator' },
            { label: t('table.alignLeft'), click: fmt('table:alignLeft') },
            { label: t('table.alignCenter'), click: fmt('table:alignCenter') },
            { label: t('table.alignRight'), click: fmt('table:alignRight') }
          ]
        },
        { type: 'separator' },
        { label: t('format.toggleImageSyntax'), click: fmt('toggleImageSyntax') },
        { label: t('format.uploadImage'), click: fmt('uploadImage') },
        { type: 'separator' },
        { label: t('format.clearFormat'), click: fmt('clearFormat') },
        { label: t('format.prettify'), click: fmt('prettify') }
      ]
    },
    {
      label: t('menu.view'),
      submenu: [
        { label: t('view.commandPalette'), accelerator: 'CmdOrCtrl+Shift+P', click: send(IPC.menuCommandPalette) },
        { label: t('view.noteGraph'), click: send(IPC.menuNoteGraph) },
        { label: t('view.sourceControl'), accelerator: 'CmdOrCtrl+Shift+G', click: send(IPC.menuSourceControl) },
        { type: 'separator' },
        { label: t('view.toggleFormatBar'), accelerator: 'CmdOrCtrl+Shift+B', click: send(IPC.menuToggleFormatBar) },
        { label: t('view.toggleSidebar'), accelerator: 'CmdOrCtrl+\\', click: send(IPC.menuToggleSidebar) },
        { label: t('view.toggleOutline'), accelerator: 'CmdOrCtrl+/', click: send(IPC.menuToggleOutline) },
        {
          label: t('view.globalSearch'),
          accelerator: 'CmdOrCtrl+Shift+F',
          click: send(IPC.menuGlobalSearch)
        },
        { type: 'separator' },
        {
          label: t('view.toggleFocus'),
          accelerator: 'F8',
          click: send(IPC.menuToggleFocusMode)
        },
        {
          label: t('view.toggleTypewriter'),
          accelerator: 'F9',
          click: send(IPC.menuToggleTypewriter)
        },
        {
          label: t('view.toggleSource'),
          accelerator: 'CmdOrCtrl+Shift+E',
          click: send(IPC.menuToggleSourceMode)
        },
        { type: 'separator' },
        { label: t('view.startSpeaking'), click: send(IPC.menuStartSpeaking) },
        { label: t('view.stopSpeaking'), click: send(IPC.menuStopSpeaking) },
        { type: 'separator' },
        { label: t('view.jumpTop'), accelerator: 'CmdOrCtrl+Home', click: send(IPC.menuJumpTop) },
        { label: t('view.jumpBottom'), accelerator: 'CmdOrCtrl+End', click: send(IPC.menuJumpBottom) },
        {
          label: t('view.alwaysOnTop'),
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
