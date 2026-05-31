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
  duplicateFile: 'fs:duplicateFile',
  deletePath: 'fs:deletePath',
  revealPath: 'fs:revealPath',
  saveImage: 'fs:saveImage',
  uploadImage: 'fs:uploadImage',
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
  menuSetLineEndingLf: 'menu:setLineEndingLf',
  menuSetLineEndingCrlf: 'menu:setLineEndingCrlf',
  menuToggleFinalNewline: 'menu:toggleFinalNewline',
  menuFormat: 'menu:format',
  // app lifecycle / unsaved-changes guard
  setDirty: 'app:setDirty',
  closeWindow: 'app:closeWindow',
  tryClose: 'app:tryClose'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
