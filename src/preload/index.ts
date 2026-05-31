import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type FileNode,
  type OpenedFile,
  type ArticleEntry,
  type SearchFileResult,
  type DraftEntry,
  type VersionEntry,
  type PdfOptions
} from '../shared/ipc'

const menuChannels = [
  IPC.menuNewFile,
  IPC.menuOpenFile,
  IPC.menuOpenFolder,
  IPC.menuSave,
  IPC.menuSaveAs,
  IPC.menuToggleSidebar,
  IPC.menuToggleOutline,
  IPC.menuToggleFocusMode,
  IPC.menuToggleTypewriter,
  IPC.menuToggleSourceMode,
  IPC.menuToggleFormatBar,
  IPC.menuJumpTop,
  IPC.menuJumpBottom,
  IPC.menuOpenQuickly,
  IPC.menuGlobalSearch,
  IPC.menuToggleAutoSave,
  IPC.menuOpenRecent,
  IPC.menuReopenClosed,
  IPC.menuClose,
  IPC.menuCloseFolder,
  IPC.menuExportHtml,
  IPC.menuExportHtmlPlain,
  IPC.menuExportPdf,
  IPC.menuPrint,
  IPC.menuPageSetup,
  IPC.menuSetLineEndingLf,
  IPC.menuSetLineEndingCrlf,
  IPC.menuToggleFinalNewline,
  IPC.menuBrowseVersions
] as const

type MenuChannel = (typeof menuChannels)[number]

const api = {
  openFileDialog: (): Promise<OpenedFile | null> => ipcRenderer.invoke(IPC.openFileDialog),
  openFolderDialog: (): Promise<FileNode | null> => ipcRenderer.invoke(IPC.openFolderDialog),
  readDir: (path: string): Promise<FileNode[]> => ipcRenderer.invoke(IPC.readDir, path),
  readFolder: (path: string): Promise<FileNode | null> =>
    ipcRenderer.invoke(IPC.readFolder, path),
  listArticles: (path: string): Promise<ArticleEntry[]> =>
    ipcRenderer.invoke(IPC.listArticles, path),
  searchInFolder: (path: string, query: string): Promise<SearchFileResult[]> =>
    ipcRenderer.invoke(IPC.searchInFolder, path, query),
  readFile: (path: string): Promise<OpenedFile> => ipcRenderer.invoke(IPC.readFile, path),
  /** Read the bundled welcome document (first-launch sample). */
  getWelcome: (): Promise<string> => ipcRenderer.invoke(IPC.getWelcome),

  /** Export the rendered document HTML to a file (save dialog). */
  exportHtml: (html: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.exportHtml, html, defaultName),
  /** Render the HTML to PDF via an offscreen window + save dialog. */
  exportPdf: (html: string, pdfOptions: PdfOptions, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.exportPdf, html, pdfOptions, defaultName),
  /** Print the rendered document HTML (system print dialog). */
  printDoc: (html: string): Promise<boolean> => ipcRenderer.invoke(IPC.printDoc, html),
  createFile: (dirPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke(IPC.createFile, dirPath, name),
  createFolder: (dirPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke(IPC.createFolder, dirPath, name),
  renamePath: (oldPath: string, newName: string): Promise<string> =>
    ipcRenderer.invoke(IPC.renamePath, oldPath, newName),
  /** Move a file/folder into a folder chosen via dialog; resolves to new path or null. */
  moveToFolder: (srcPath: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.moveToFolder, srcPath),
  duplicateFile: (path: string): Promise<string> =>
    ipcRenderer.invoke(IPC.duplicateFile, path),
  deletePath: (path: string): Promise<boolean> => ipcRenderer.invoke(IPC.deletePath, path),
  revealPath: (path: string): Promise<void> => ipcRenderer.invoke(IPC.revealPath, path),
  saveFile: (path: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.saveFile, path, content),
  saveFileAs: (content: string): Promise<OpenedFile | null> =>
    ipcRenderer.invoke(IPC.saveFileAs, content),
  /** Save image bytes to the doc's assets folder; returns the relative path or null. */
  saveImage: (docPath: string | null, name: string, data: Uint8Array): Promise<string | null> =>
    ipcRenderer.invoke(IPC.saveImage, docPath, name, data),
  /** Open a file dialog to pick a local image; resolves to its name + bytes. */
  pickImage: (): Promise<{ name: string; data: Uint8Array } | null> =>
    ipcRenderer.invoke(IPC.pickImage),
  /** Upload an image via a configured shell command; resolves to the URL. */
  uploadImage: (command: string, filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.uploadImage, command, filePath),

  /** Crash-recovery drafts. */
  saveDraft: (draft: DraftEntry): Promise<boolean> => ipcRenderer.invoke(IPC.saveDraft, draft),
  listDrafts: (): Promise<DraftEntry[]> => ipcRenderer.invoke(IPC.listDrafts),
  clearDraft: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.clearDraft, id),

  /** Local version history. */
  saveVersion: (id: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.saveVersion, id, content),
  listVersions: (id: string): Promise<VersionEntry[]> => ipcRenderer.invoke(IPC.listVersions, id),
  readVersion: (id: string, savedAt: number): Promise<string | null> =>
    ipcRenderer.invoke(IPC.readVersion, id, savedAt),

  /** Watch the open document for external changes (pass null to stop). */
  watchFile: (path: string | null): Promise<void> => ipcRenderer.invoke(IPC.watchFile, path),
  /** Open file was changed on disk by another program; handler gets the new content. */
  onFileChangedExternally: (handler: (content: string) => void): (() => void) => {
    const listener = (_e: unknown, content: string): void => handler(content)
    ipcRenderer.on(IPC.fileChangedExternally, listener)
    return () => ipcRenderer.removeListener(IPC.fileChangedExternally, listener)
  },
  /** Open file was deleted/moved on disk. */
  onFileRemovedExternally: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IPC.fileRemovedExternally, listener)
    return () => ipcRenderer.removeListener(IPC.fileRemovedExternally, listener)
  },

  /** Tell the main process whether the document has unsaved changes. */
  setDirty: (dirty: boolean): void => ipcRenderer.send(IPC.setDirty, dirty),
  /** Ask the main process to close the window (after the guard has passed). */
  closeWindow: (): void => ipcRenderer.send(IPC.closeWindow),
  /** Main asks the renderer to handle a close attempt (run the unsaved guard). */
  onTryClose: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IPC.tryClose, listener)
    return () => ipcRenderer.removeListener(IPC.tryClose, listener)
  },

  /** Subscribe to Format-menu commands; handler receives the action id. */
  onFormat: (handler: (action: string) => void): (() => void) => {
    const listener = (_e: unknown, action: string): void => handler(action)
    ipcRenderer.on(IPC.menuFormat, listener)
    return () => ipcRenderer.removeListener(IPC.menuFormat, listener)
  },

  /** Subscribe to a menu command coming from the main process. Returns an unsubscribe fn. */
  onMenu: (channel: MenuChannel, handler: () => void): (() => void) => {
    // Guard against unexpected channels (also keeps `menuChannels` a runtime value).
    if (!menuChannels.includes(channel)) return () => undefined
    const listener = (): void => handler()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type InkwellApi = typeof api
