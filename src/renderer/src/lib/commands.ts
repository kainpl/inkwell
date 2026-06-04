import { IPC } from '@shared/ipc'

/**
 * The command-palette registry. Pure data: each command re-fires an existing
 * menu channel (via window.api.triggerMenu), so behaviour never drifts from the
 * native menus and no action logic is duplicated here. Format commands target
 * `menuFormat` with the action id as `arg`; pandoc exports target
 * `menuExportPandoc` with the format as `arg`.
 *
 * `title`/`category` are the English source text (kept for the fuzzy index and
 * as a fallback); `titleKey` points at a `shared/i18n` key so the palette and
 * the Preferences ▸ Keyboard list can render the command in the active locale.
 */
export interface Command {
  id: string
  title: string
  /** i18n key for the localized title (falls back to `title`). */
  titleKey: string
  category: 'File' | 'Edit' | 'Format' | 'View' | 'Export' | 'Go'
  channel: string
  arg?: string
}

/** Convenience: a Format command (fires menuFormat with the action id). */
function fmt(id: string, title: string, titleKey = `format.${id}`): Command {
  return { id: `format.${id}`, title, titleKey, category: 'Format', channel: IPC.menuFormat, arg: id }
}

/** i18n key for a command's category chip. */
export function categoryKey(c: Command): string {
  return `cat.${c.category.toLowerCase()}`
}

export const COMMANDS: Command[] = [
  // File
  { id: 'file.new', title: 'New File', titleKey: 'cmd.fileNew', category: 'File', channel: IPC.menuNewFile },
  { id: 'file.newTemplate', title: 'New from Template…', titleKey: 'file.newFromTemplate', category: 'File', channel: IPC.menuNewFromTemplate },
  { id: 'file.open', title: 'Open File…', titleKey: 'file.openFile', category: 'File', channel: IPC.menuOpenFile },
  { id: 'file.openFolder', title: 'Open Folder…', titleKey: 'file.openFolder', category: 'File', channel: IPC.menuOpenFolder },
  { id: 'file.connectDrive', title: 'Connect Google Drive…', titleKey: 'file.connectDrive', category: 'File', channel: IPC.menuConnectDrive },
  { id: 'file.save', title: 'Save', titleKey: 'file.save', category: 'File', channel: IPC.menuSave },
  { id: 'file.saveAs', title: 'Save As…', titleKey: 'file.saveAs', category: 'File', channel: IPC.menuSaveAs },
  { id: 'file.saveAll', title: 'Save All', titleKey: 'file.saveAll', category: 'File', channel: IPC.menuSaveAll },
  { id: 'file.reopen', title: 'Reopen Closed File', titleKey: 'file.reopenClosed', category: 'File', channel: IPC.menuReopenClosed },
  { id: 'file.close', title: 'Close', titleKey: 'file.close', category: 'File', channel: IPC.menuClose },
  { id: 'file.closeFolder', title: 'Close Folder', titleKey: 'file.closeFolder', category: 'File', channel: IPC.menuCloseFolder },
  { id: 'file.autoSave', title: 'Toggle Auto Save', titleKey: 'cmd.toggleAutoSave', category: 'File', channel: IPC.menuToggleAutoSave },
  { id: 'file.lf', title: 'Line Endings: LF (Unix)', titleKey: 'cmd.lineEndingsLf', category: 'File', channel: IPC.menuSetLineEndingLf },
  { id: 'file.crlf', title: 'Line Endings: CRLF (Windows)', titleKey: 'cmd.lineEndingsCrlf', category: 'File', channel: IPC.menuSetLineEndingCrlf },
  { id: 'file.finalNewline', title: 'Toggle Insert Final Newline', titleKey: 'cmd.toggleFinalNewline', category: 'File', channel: IPC.menuToggleFinalNewline },

  // Edit
  { id: 'edit.preferences', title: 'Preferences…', titleKey: 'edit.preferences', category: 'Edit', channel: IPC.menuPreferences },
  { id: 'edit.copyMarkdown', title: 'Copy as Markdown', titleKey: 'cmd.copyMarkdown', category: 'Edit', channel: IPC.menuCopyMarkdown },
  { id: 'edit.copyHtml', title: 'Copy as HTML', titleKey: 'cmd.copyHtml', category: 'Edit', channel: IPC.menuCopyHtml },
  { id: 'edit.copyPlain', title: 'Copy as Plain Text', titleKey: 'cmd.copyPlain', category: 'Edit', channel: IPC.menuCopyPlain },
  { id: 'edit.copyImage', title: 'Copy as Image', titleKey: 'cmd.copyImage', category: 'Edit', channel: IPC.menuCopyImage },
  { id: 'edit.selectNext', title: 'Select Next Occurrence (Ctrl/⌘ D)', titleKey: 'cmd.selectNext', category: 'Edit', channel: IPC.menuFormat, arg: 'selectNextOccurrence' },
  { id: 'edit.cursorAbove', title: 'Add Cursor Above (Ctrl/⌘ Alt ↑)', titleKey: 'cmd.cursorAbove', category: 'Edit', channel: IPC.menuFormat, arg: 'cursorAbove' },
  { id: 'edit.cursorBelow', title: 'Add Cursor Below (Ctrl/⌘ Alt ↓)', titleKey: 'cmd.cursorBelow', category: 'Edit', channel: IPC.menuFormat, arg: 'cursorBelow' },

  // Format
  fmt('bold', 'Bold'),
  fmt('italic', 'Italic'),
  fmt('strike', 'Strikethrough'),
  fmt('code', 'Inline Code'),
  fmt('highlight', 'Highlight'),
  fmt('sub', 'Subscript'),
  fmt('sup', 'Superscript'),
  fmt('h1', 'Heading 1'),
  fmt('h2', 'Heading 2'),
  fmt('h3', 'Heading 3'),
  fmt('h4', 'Heading 4'),
  fmt('h5', 'Heading 5'),
  fmt('h6', 'Heading 6'),
  fmt('ul', 'Bullet List'),
  fmt('ol', 'Numbered List'),
  fmt('task', 'Task List'),
  fmt('quote', 'Quote'),
  fmt('link', 'Link'),
  fmt('image', 'Insert Image…'),
  fmt('table', 'Table'),
  fmt('codeblock', 'Code Block'),
  fmt('hr', 'Horizontal Rule'),
  fmt('footnote', 'Footnote'),
  fmt('mathInline', 'Inline Math'),
  fmt('mathBlock', 'Math Block'),
  fmt('mermaid', 'Mermaid Diagram'),
  fmt('toc', 'Table of Contents'),
  fmt('alert:note', 'Alert: Note', 'cmd.alertNote'),
  fmt('alert:tip', 'Alert: Tip', 'cmd.alertTip'),
  fmt('alert:important', 'Alert: Important', 'cmd.alertImportant'),
  fmt('alert:warning', 'Alert: Warning', 'cmd.alertWarning'),
  fmt('alert:caution', 'Alert: Caution', 'cmd.alertCaution'),
  fmt('table:rowAbove', 'Table: Insert Row Above', 'cmd.tableRowAbove'),
  fmt('table:rowBelow', 'Table: Insert Row Below', 'cmd.tableRowBelow'),
  fmt('table:deleteRow', 'Table: Delete Row', 'cmd.tableDeleteRow'),
  fmt('table:colBefore', 'Table: Insert Column Before', 'cmd.tableColBefore'),
  fmt('table:colAfter', 'Table: Insert Column After', 'cmd.tableColAfter'),
  fmt('table:deleteCol', 'Table: Delete Column', 'cmd.tableDeleteCol'),
  fmt('table:alignLeft', 'Table: Align Left', 'cmd.tableAlignLeft'),
  fmt('table:alignCenter', 'Table: Align Center', 'cmd.tableAlignCenter'),
  fmt('table:alignRight', 'Table: Align Right', 'cmd.tableAlignRight'),
  fmt('toggleImageSyntax', 'Toggle Image Markdown/HTML'),
  fmt('uploadImage', 'Upload Image'),
  fmt('clearFormat', 'Clear Format'),
  fmt('prettify', 'Prettify Source'),

  // View
  { id: 'view.formatBar', title: 'Toggle Formatting Bar', titleKey: 'view.toggleFormatBar', category: 'View', channel: IPC.menuToggleFormatBar },
  { id: 'view.sidebar', title: 'Toggle Sidebar', titleKey: 'view.toggleSidebar', category: 'View', channel: IPC.menuToggleSidebar },
  { id: 'view.outline', title: 'Toggle Outline', titleKey: 'view.toggleOutline', category: 'View', channel: IPC.menuToggleOutline },
  { id: 'view.outlinePopover', title: 'Outline…', titleKey: 'view.outlinePopover', category: 'View', channel: IPC.menuOutlinePopover },
  { id: 'view.focus', title: 'Toggle Focus Mode', titleKey: 'view.toggleFocus', category: 'View', channel: IPC.menuToggleFocusMode },
  { id: 'view.typewriter', title: 'Toggle Typewriter Mode', titleKey: 'view.toggleTypewriter', category: 'View', channel: IPC.menuToggleTypewriter },
  { id: 'view.source', title: 'Toggle Source Code Mode', titleKey: 'view.toggleSource', category: 'View', channel: IPC.menuToggleSourceMode },
  { id: 'view.speak', title: 'Start Speaking', titleKey: 'view.startSpeaking', category: 'View', channel: IPC.menuStartSpeaking },
  { id: 'view.stopSpeak', title: 'Stop Speaking', titleKey: 'view.stopSpeaking', category: 'View', channel: IPC.menuStopSpeaking },

  // Go
  { id: 'go.file', title: 'Go to File…', titleKey: 'cmd.goToFile', category: 'Go', channel: IPC.menuOpenQuickly },
  { id: 'go.search', title: 'Search in Folder…', titleKey: 'view.globalSearch', category: 'Go', channel: IPC.menuGlobalSearch },
  { id: 'go.recent', title: 'Open Recent…', titleKey: 'file.openRecent', category: 'Go', channel: IPC.menuOpenRecent },
  { id: 'go.versions', title: 'Browse All Versions…', titleKey: 'file.browseVersions', category: 'Go', channel: IPC.menuBrowseVersions },
  { id: 'go.graph', title: 'Note Graph…', titleKey: 'view.noteGraph', category: 'Go', channel: IPC.menuNoteGraph },
  { id: 'go.git', title: 'Source Control…', titleKey: 'view.sourceControl', category: 'Go', channel: IPC.menuSourceControl },
  { id: 'go.top', title: 'Jump to Top', titleKey: 'view.jumpTop', category: 'Go', channel: IPC.menuJumpTop },
  { id: 'go.bottom', title: 'Jump to Bottom', titleKey: 'view.jumpBottom', category: 'Go', channel: IPC.menuJumpBottom },

  // Export
  { id: 'export.html', title: 'Export HTML (with styles)…', titleKey: 'cmd.exportHtml', category: 'Export', channel: IPC.menuExportHtml },
  { id: 'export.htmlPlain', title: 'Export HTML (without styles)…', titleKey: 'cmd.exportHtmlPlain', category: 'Export', channel: IPC.menuExportHtmlPlain },
  { id: 'export.pdf', title: 'Export PDF…', titleKey: 'cmd.exportPdf', category: 'Export', channel: IPC.menuExportPdf },
  { id: 'export.image', title: 'Export Image (PNG)…', titleKey: 'cmd.exportImage', category: 'Export', channel: IPC.menuExportImage },
  { id: 'export.docx', title: 'Export Word (.docx)…', titleKey: 'cmd.exportDocx', category: 'Export', channel: IPC.menuExportPandoc, arg: 'docx' },
  { id: 'export.odt', title: 'Export OpenDocument (.odt)…', titleKey: 'cmd.exportOdt', category: 'Export', channel: IPC.menuExportPandoc, arg: 'odt' },
  { id: 'export.rtf', title: 'Export Rich Text (.rtf)…', titleKey: 'cmd.exportRtf', category: 'Export', channel: IPC.menuExportPandoc, arg: 'rtf' },
  { id: 'export.epub', title: 'Export EPUB (.epub)…', titleKey: 'cmd.exportEpub', category: 'Export', channel: IPC.menuExportPandoc, arg: 'epub' },
  { id: 'export.latex', title: 'Export LaTeX (.tex)…', titleKey: 'cmd.exportLatex', category: 'Export', channel: IPC.menuExportPandoc, arg: 'latex' },
  { id: 'export.pageSetup', title: 'Page Setup…', titleKey: 'file.pageSetup', category: 'Export', channel: IPC.menuPageSetup },
  { id: 'export.print', title: 'Print…', titleKey: 'file.print', category: 'Export', channel: IPC.menuPrint }
]

/** The string a command is fuzzy-matched against (English source index). */
export function commandSearchText(c: Command): string {
  return `${c.category} ${c.title}`
}
