import { IPC } from '@shared/ipc'

/**
 * The command-palette registry. Pure data: each command re-fires an existing
 * menu channel (via window.api.triggerMenu), so behaviour never drifts from the
 * native menus and no action logic is duplicated here. Format commands target
 * `menuFormat` with the action id as `arg`; pandoc exports target
 * `menuExportPandoc` with the format as `arg`.
 */
export interface Command {
  id: string
  title: string
  category: 'File' | 'Edit' | 'Format' | 'View' | 'Export' | 'Go'
  channel: string
  arg?: string
}

/** Convenience: a Format command (fires menuFormat with the action id). */
function fmt(id: string, title: string): Command {
  return { id: `format.${id}`, title, category: 'Format', channel: IPC.menuFormat, arg: id }
}

export const COMMANDS: Command[] = [
  // File
  { id: 'file.new', title: 'New File', category: 'File', channel: IPC.menuNewFile },
  { id: 'file.newTemplate', title: 'New from Template…', category: 'File', channel: IPC.menuNewFromTemplate },
  { id: 'file.open', title: 'Open File…', category: 'File', channel: IPC.menuOpenFile },
  { id: 'file.openFolder', title: 'Open Folder…', category: 'File', channel: IPC.menuOpenFolder },
  { id: 'file.save', title: 'Save', category: 'File', channel: IPC.menuSave },
  { id: 'file.saveAs', title: 'Save As…', category: 'File', channel: IPC.menuSaveAs },
  { id: 'file.reopen', title: 'Reopen Closed File', category: 'File', channel: IPC.menuReopenClosed },
  { id: 'file.close', title: 'Close', category: 'File', channel: IPC.menuClose },
  { id: 'file.closeFolder', title: 'Close Folder', category: 'File', channel: IPC.menuCloseFolder },
  { id: 'file.autoSave', title: 'Toggle Auto Save', category: 'File', channel: IPC.menuToggleAutoSave },
  { id: 'file.lf', title: 'Line Endings: LF (Unix)', category: 'File', channel: IPC.menuSetLineEndingLf },
  { id: 'file.crlf', title: 'Line Endings: CRLF (Windows)', category: 'File', channel: IPC.menuSetLineEndingCrlf },
  { id: 'file.finalNewline', title: 'Toggle Insert Final Newline', category: 'File', channel: IPC.menuToggleFinalNewline },

  // Edit
  { id: 'edit.preferences', title: 'Preferences…', category: 'Edit', channel: IPC.menuPreferences },
  { id: 'edit.copyMarkdown', title: 'Copy as Markdown', category: 'Edit', channel: IPC.menuCopyMarkdown },
  { id: 'edit.copyHtml', title: 'Copy as HTML', category: 'Edit', channel: IPC.menuCopyHtml },
  { id: 'edit.copyPlain', title: 'Copy as Plain Text', category: 'Edit', channel: IPC.menuCopyPlain },
  { id: 'edit.copyImage', title: 'Copy as Image', category: 'Edit', channel: IPC.menuCopyImage },
  { id: 'edit.selectNext', title: 'Select Next Occurrence (Ctrl/⌘ D)', category: 'Edit', channel: IPC.menuFormat, arg: 'selectNextOccurrence' },
  { id: 'edit.cursorAbove', title: 'Add Cursor Above (Ctrl/⌘ Alt ↑)', category: 'Edit', channel: IPC.menuFormat, arg: 'cursorAbove' },
  { id: 'edit.cursorBelow', title: 'Add Cursor Below (Ctrl/⌘ Alt ↓)', category: 'Edit', channel: IPC.menuFormat, arg: 'cursorBelow' },

  // Format
  fmt('bold', 'Bold'),
  fmt('italic', 'Italic'),
  fmt('strike', 'Strikethrough'),
  fmt('code', 'Inline Code'),
  fmt('highlight', 'Highlight'),
  fmt('h1', 'Heading 1'),
  fmt('h2', 'Heading 2'),
  fmt('h3', 'Heading 3'),
  fmt('ul', 'Bullet List'),
  fmt('ol', 'Numbered List'),
  fmt('task', 'Task List'),
  fmt('quote', 'Quote'),
  fmt('link', 'Link'),
  fmt('image', 'Insert Image…'),
  fmt('table', 'Table'),
  fmt('codeblock', 'Code Block'),
  fmt('hr', 'Horizontal Rule'),
  fmt('table:rowAbove', 'Table: Insert Row Above'),
  fmt('table:rowBelow', 'Table: Insert Row Below'),
  fmt('table:deleteRow', 'Table: Delete Row'),
  fmt('table:colBefore', 'Table: Insert Column Before'),
  fmt('table:colAfter', 'Table: Insert Column After'),
  fmt('table:deleteCol', 'Table: Delete Column'),
  fmt('table:alignLeft', 'Table: Align Left'),
  fmt('table:alignCenter', 'Table: Align Center'),
  fmt('table:alignRight', 'Table: Align Right'),
  fmt('toggleImageSyntax', 'Toggle Image Markdown/HTML'),
  fmt('uploadImage', 'Upload Image'),
  fmt('clearFormat', 'Clear Format'),
  fmt('prettify', 'Prettify Source'),

  // View
  { id: 'view.formatBar', title: 'Toggle Formatting Bar', category: 'View', channel: IPC.menuToggleFormatBar },
  { id: 'view.sidebar', title: 'Toggle Sidebar', category: 'View', channel: IPC.menuToggleSidebar },
  { id: 'view.outline', title: 'Toggle Outline', category: 'View', channel: IPC.menuToggleOutline },
  { id: 'view.focus', title: 'Toggle Focus Mode', category: 'View', channel: IPC.menuToggleFocusMode },
  { id: 'view.typewriter', title: 'Toggle Typewriter Mode', category: 'View', channel: IPC.menuToggleTypewriter },
  { id: 'view.source', title: 'Toggle Source Code Mode', category: 'View', channel: IPC.menuToggleSourceMode },
  { id: 'view.speak', title: 'Start Speaking', category: 'View', channel: IPC.menuStartSpeaking },
  { id: 'view.stopSpeak', title: 'Stop Speaking', category: 'View', channel: IPC.menuStopSpeaking },

  // Go
  { id: 'go.file', title: 'Go to File…', category: 'Go', channel: IPC.menuOpenQuickly },
  { id: 'go.search', title: 'Search in Folder…', category: 'Go', channel: IPC.menuGlobalSearch },
  { id: 'go.recent', title: 'Open Recent…', category: 'Go', channel: IPC.menuOpenRecent },
  { id: 'go.versions', title: 'Browse All Versions…', category: 'Go', channel: IPC.menuBrowseVersions },
  { id: 'go.top', title: 'Jump to Top', category: 'Go', channel: IPC.menuJumpTop },
  { id: 'go.bottom', title: 'Jump to Bottom', category: 'Go', channel: IPC.menuJumpBottom },

  // Export
  { id: 'export.html', title: 'Export HTML (with styles)…', category: 'Export', channel: IPC.menuExportHtml },
  { id: 'export.htmlPlain', title: 'Export HTML (without styles)…', category: 'Export', channel: IPC.menuExportHtmlPlain },
  { id: 'export.pdf', title: 'Export PDF…', category: 'Export', channel: IPC.menuExportPdf },
  { id: 'export.image', title: 'Export Image (PNG)…', category: 'Export', channel: IPC.menuExportImage },
  { id: 'export.docx', title: 'Export Word (.docx)…', category: 'Export', channel: IPC.menuExportPandoc, arg: 'docx' },
  { id: 'export.odt', title: 'Export OpenDocument (.odt)…', category: 'Export', channel: IPC.menuExportPandoc, arg: 'odt' },
  { id: 'export.rtf', title: 'Export Rich Text (.rtf)…', category: 'Export', channel: IPC.menuExportPandoc, arg: 'rtf' },
  { id: 'export.epub', title: 'Export EPUB (.epub)…', category: 'Export', channel: IPC.menuExportPandoc, arg: 'epub' },
  { id: 'export.latex', title: 'Export LaTeX (.tex)…', category: 'Export', channel: IPC.menuExportPandoc, arg: 'latex' },
  { id: 'export.pageSetup', title: 'Page Setup…', category: 'Export', channel: IPC.menuPageSetup },
  { id: 'export.print', title: 'Print…', category: 'Export', channel: IPC.menuPrint }
]

/** The string a command is fuzzy-matched against. */
export function commandSearchText(c: Command): string {
  return `${c.category} ${c.title}`
}
