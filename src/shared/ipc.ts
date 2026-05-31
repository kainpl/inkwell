/**
 * Shared contract between the main and renderer processes.
 * Keep this file dependency-free so it can be imported from any process.
 */

export interface FileNode {
  /** Absolute path on disk */
  path: string
  /** Display name (basename) */
  name: string
  /** Directory vs file */
  type: 'file' | 'directory'
  /** Populated lazily for directories */
  children?: FileNode[]
}

export interface OpenedFile {
  path: string
  name: string
  content: string
}

/** A markdown file in the workspace, for the Articles list / quick-open. */
export interface ArticleEntry {
  path: string
  name: string
  /** Last-modified time (ms since epoch). */
  mtime: number
}

/** One matching line within a file, for global search results. */
export interface SearchMatch {
  /** 1-based line number. */
  line: number
  /** Character offset of the line start in the document. */
  offset: number
  /** The full matching line's text (trimmed for display). */
  text: string
}

/** Search results grouped by file. */
export interface SearchFileResult {
  path: string
  name: string
  matches: SearchMatch[]
}

/** printToPDF options we set, kept electron-agnostic so the renderer can build them. */
export interface PdfOptions {
  landscape: boolean
  printBackground: boolean
  margins: { marginType: 'custom'; top: number; bottom: number; left: number; right: number }
  pageSize: string | { width: number; height: number }
}

/** One entry in a document's local version history ("Browse All Versions"). */
export interface VersionEntry {
  /** When the snapshot was taken (ms since epoch); also its filename stem. */
  savedAt: number
  /** Byte length of the snapshot, for display. */
  size: number
}

/** An external theme found in the user's themes folder. */
export interface ExternalTheme {
  /** Filename without `.css` — also the selectable theme id. */
  id: string
  /** Humanised display name. */
  label: string
  /** Provides a light edition (`:root { … }`). */
  light: boolean
  /** Provides a dark edition (`:root.dark { … }` or legacy `inkwell: dark`). */
  dark: boolean
}

/** A theme's CSS plus the user-override cascade (each null when absent). */
export interface ThemeCss {
  /** The external theme file's CSS (null for built-in themes). */
  theme: string | null
  /** `base.user.css` — always applied, over any theme. */
  base: string | null
  /** `{id}.user.css` — applied when this theme is active. */
  themeUser: string | null
}

/** A recoverable autosaved draft (crash recovery). */
export interface DraftEntry {
  /** Stable id derived from the document path (or "untitled"). */
  id: string
  /** Original document path, or null for an unsaved doc. */
  docPath: string | null
  /** Display name. */
  name: string
  /** The drafted content. */
  content: string
  /** When the draft was written (ms since epoch). */
  savedAt: number
}

/** IPC channel names. One source of truth for both sides. */
export const IPC = {
  // renderer -> main (invoke/handle)
  openFileDialog: 'dialog:openFile',
  openFolderDialog: 'dialog:openFolder',
  readFile: 'fs:readFile',
  saveFile: 'fs:saveFile',
  saveFileAs: 'fs:saveFileAs',
  readDir: 'fs:readDir',
  readFolder: 'fs:readFolder',
  listArticles: 'fs:listArticles',
  searchInFolder: 'fs:searchInFolder',
  createFile: 'fs:createFile',
  createFolder: 'fs:createFolder',
  renamePath: 'fs:renamePath',
  moveToFolder: 'fs:moveToFolder',
  duplicateFile: 'fs:duplicateFile',
  deletePath: 'fs:deletePath',
  revealPath: 'fs:revealPath',
  saveImage: 'fs:saveImage',
  pickImage: 'fs:pickImage',
  uploadImage: 'fs:uploadImage',
  // crash-recovery drafts (autosaved snapshots in userData)
  saveDraft: 'draft:save',
  listDrafts: 'draft:list',
  clearDraft: 'draft:clear',
  // local version history (snapshots in userData/versions)
  saveVersion: 'version:save',
  listVersions: 'version:list',
  readVersion: 'version:read',
  // watch the open document for external changes on disk
  watchFile: 'watch:file',
  // read the bundled welcome document from disk (first-launch sample)
  getWelcome: 'app:getWelcome',
  // external themes (userData/themes)
  listThemes: 'theme:list',
  readThemeCss: 'theme:readCss',
  openThemesFolder: 'theme:openFolder',
  // main -> renderer: the themes folder changed (added/edited/removed a file)
  themesChanged: 'theme:changed',
  // export / print
  exportHtml: 'export:html',
  exportPdf: 'export:pdf',
  exportImage: 'export:image',
  printDoc: 'export:print',
  clipboardWrite: 'export:clipboardWrite',
  copyImage: 'export:copyImage',
  exportPandoc: 'export:pandoc',
  // main -> renderer: pandoc download progress (0–100, or -1 on error/cancel)
  pandocProgress: 'export:pandocProgress',
  // main -> renderer (send/on)
  menuNewFile: 'menu:newFile',
  menuOpenFile: 'menu:openFile',
  menuOpenFolder: 'menu:openFolder',
  menuSave: 'menu:save',
  menuSaveAs: 'menu:saveAs',
  menuToggleSidebar: 'menu:toggleSidebar',
  menuToggleOutline: 'menu:toggleOutline',
  menuToggleFocusMode: 'menu:toggleFocusMode',
  menuToggleTypewriter: 'menu:toggleTypewriter',
  menuToggleSourceMode: 'menu:toggleSourceMode',
  menuToggleFormatBar: 'menu:toggleFormatBar',
  menuJumpTop: 'menu:jumpTop',
  menuJumpBottom: 'menu:jumpBottom',
  menuOpenQuickly: 'menu:openQuickly',
  menuGlobalSearch: 'menu:globalSearch',
  menuToggleAutoSave: 'menu:toggleAutoSave',
  menuOpenRecent: 'menu:openRecent',
  menuReopenClosed: 'menu:reopenClosed',
  menuClose: 'menu:close',
  menuCloseFolder: 'menu:closeFolder',
  menuSetLineEndingLf: 'menu:setLineEndingLf',
  menuSetLineEndingCrlf: 'menu:setLineEndingCrlf',
  menuToggleFinalNewline: 'menu:toggleFinalNewline',
  menuBrowseVersions: 'menu:browseVersions',
  menuExportHtml: 'menu:exportHtml',
  menuExportHtmlPlain: 'menu:exportHtmlPlain',
  menuExportPdf: 'menu:exportPdf',
  menuPrint: 'menu:print',
  menuPageSetup: 'menu:pageSetup',
  menuCopyMarkdown: 'menu:copyMarkdown',
  menuCopyHtml: 'menu:copyHtml',
  menuCopyPlain: 'menu:copyPlain',
  menuCopyImage: 'menu:copyImage',
  menuExportImage: 'menu:exportImage',
  menuExportPandoc: 'menu:exportPandoc',
  menuPreferences: 'menu:preferences',
  menuCommandPalette: 'menu:commandPalette',
  menuFormat: 'menu:format',
  // renderer -> main: re-fire a menu channel back to the renderer (command palette)
  triggerMenu: 'menu:trigger',
  // open document changed/removed on disk by another program
  fileChangedExternally: 'watch:changed',
  fileRemovedExternally: 'watch:removed',
  // renderer -> main: apply the auto-hide-menu-bar preference to the window
  setMenuBarAutoHide: 'app:setMenuBarAutoHide',
  // app lifecycle / unsaved-changes guard
  setDirty: 'app:setDirty',
  closeWindow: 'app:closeWindow',
  tryClose: 'app:tryClose'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
