import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type FileNode,
  type OpenedFile,
  type ArticleEntry,
  type SearchFileResult,
  type DraftEntry,
  type VersionEntry,
  type PdfOptions,
  type ExternalTheme,
  type ThemeCss,
  type TemplateEntry,
  type SpellDict,
  type GitChanges,
  type GitResult,
  type GitBranch
} from '../shared/ipc'
import type { NoteGraph } from '../shared/noteGraph'
import type { DriveAccount, DriveNode } from '../shared/drive'
import type { Locale } from '../shared/i18n'
import type { DocRef, InkprojSavePayload, OpenedInkproj, PickedExternal } from '../shared/mindmap/types'

const menuChannels = [
  IPC.menuNewFile,
  IPC.menuOpenFile,
  IPC.menuNewProject,
  IPC.menuOpenProject,
  IPC.menuImportMindMap,
  IPC.menuExportMindMap,
  IPC.menuExportHtmlProject,
  IPC.menuExportSchemaOpml,
  IPC.menuExportSchemaMd,
  IPC.menuExportSchemaMm,
  IPC.menuExportProjectPdf,
  IPC.menuExportProjectImage,
  IPC.menuPrintProject,
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
  IPC.menuCopyMarkdown,
  IPC.menuCopyHtml,
  IPC.menuCopyPlain,
  IPC.menuCopyImage,
  IPC.menuExportImage,
  IPC.menuPreferences,
  IPC.menuCommandPalette,
  IPC.menuNoteGraph,
  IPC.menuSourceControl,
  IPC.menuConnectDrive,
  IPC.menuNewFromTemplate,
  IPC.menuStartSpeaking,
  IPC.menuStopSpeaking,
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
  /** Render the HTML to a PNG image and save it (save dialog). */
  exportImage: (html: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.exportImage, html, defaultName),
  /** Render the HTML to a PNG image and copy it to the clipboard. */
  copyImage: (html: string): Promise<boolean> => ipcRenderer.invoke(IPC.copyImage, html),
  /** Export Markdown to docx/odt/rtf/epub/latex via pandoc (save dialog). */
  exportPandoc: (
    markdown: string,
    format: string,
    ext: string,
    docPath: string | null,
    defaultName: string
  ): Promise<boolean> =>
    ipcRenderer.invoke(IPC.exportPandoc, markdown, format, ext, docPath, defaultName),
  /** Subscribe to a pandoc-export menu command; handler receives the format id. */
  onExportPandoc: (handler: (format: string) => void): (() => void) => {
    const listener = (_e: unknown, format: string): void => handler(format)
    ipcRenderer.on(IPC.menuExportPandoc, listener)
    return () => ipcRenderer.removeListener(IPC.menuExportPandoc, listener)
  },
  /** Pandoc download progress (0–100; -1 means done/cancelled/error → hide). */
  onPandocProgress: (handler: (pct: number) => void): (() => void) => {
    const listener = (_e: unknown, pct: number): void => handler(pct)
    ipcRenderer.on(IPC.pandocProgress, listener)
    return () => ipcRenderer.removeListener(IPC.pandocProgress, listener)
  },
  /** Render to PDF and open it in the OS viewer for preview + print. */
  printDoc: (html: string, pdfOptions: PdfOptions): Promise<boolean> =>
    ipcRenderer.invoke(IPC.printDoc, html, pdfOptions),
  /** Write text and/or HTML to the system clipboard (Copy as…). */
  clipboardWrite: (data: { text?: string; html?: string }): Promise<boolean> =>
    ipcRenderer.invoke(IPC.clipboardWrite, data),
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

  /** Download (or read cached) a hunspell dictionary for a language. */
  getSpellDict: (lang: string): Promise<SpellDict> => ipcRenderer.invoke(IPC.getSpellDict, lang),
  /** Dictionary download progress (0–100; -1 done/error → hide). */
  onSpellProgress: (handler: (pct: number) => void): (() => void) => {
    const listener = (_e: unknown, pct: number): void => handler(pct)
    ipcRenderer.on(IPC.spellProgress, listener)
    return () => ipcRenderer.removeListener(IPC.spellProgress, listener)
  },

  /** Git status of the open folder (path → status char), or null if not a repo. */
  gitStatus: (folder: string): Promise<Record<string, string> | null> =>
    ipcRenderer.invoke(IPC.gitStatus, folder),

  /** Detailed staged/unstaged changes for the Source Control panel. */
  gitChanges: (folder: string): Promise<GitChanges> => ipcRenderer.invoke(IPC.gitChanges, folder),

  /** Stage the given repo-relative paths. */
  gitStage: (folder: string, paths: string[]): Promise<GitResult> =>
    ipcRenderer.invoke(IPC.gitStage, folder, paths),

  /** Unstage the given repo-relative paths. */
  gitUnstage: (folder: string, paths: string[]): Promise<GitResult> =>
    ipcRenderer.invoke(IPC.gitUnstage, folder, paths),

  /** Commit the staged changes with a message. */
  gitCommit: (folder: string, message: string): Promise<GitResult> =>
    ipcRenderer.invoke(IPC.gitCommit, folder, message),

  /** Push the current branch to its upstream. */
  gitPush: (folder: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitPush, folder),

  /** Pull the current branch from its upstream. */
  gitPull: (folder: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitPull, folder),

  /** Branch name + ahead/behind counts for the status-bar indicator. */
  gitBranch: (folder: string): Promise<GitBranch | null> => ipcRenderer.invoke(IPC.gitBranch, folder),

  /** Build the wiki-link graph for the workspace. */
  noteGraph: (folder: string): Promise<NoteGraph> => ipcRenderer.invoke(IPC.noteGraph, folder),

  /** Mind-map / schema project files (.inkproj). Read-only in M1. */
  inkproj: {
    open: (path: string): Promise<OpenedInkproj> => ipcRenderer.invoke(IPC.inkprojOpen, path),
    openDialog: (): Promise<OpenedInkproj | null> => ipcRenderer.invoke(IPC.inkprojOpenDialog),
    createDialog: (): Promise<OpenedInkproj | null> => ipcRenderer.invoke(IPC.inkprojCreateDialog),
    createUntitled: (schemaText?: string): Promise<OpenedInkproj> =>
      ipcRenderer.invoke(IPC.inkprojCreateUntitled, schemaText),
    saveAs: (workingDir: string, payload: InkprojSavePayload): Promise<string | null> =>
      ipcRenderer.invoke(IPC.inkprojSaveAs, workingDir, payload),
    pickImportFile: (): Promise<{ name: string; text?: string; base64?: string } | null> =>
      ipcRenderer.invoke(IPC.inkprojPickImportFile),
    createFromImport: (schemaText: string, title: string): Promise<OpenedInkproj | null> =>
      ipcRenderer.invoke(IPC.inkprojCreateFromImport, schemaText, title),
    exportMindMap: (schemaText: string, suggestedName: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.inkprojExportMindMap, schemaText, suggestedName),
    exportHtml: (html: string, suggestedName: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.inkprojExportHtml, html, suggestedName),
    exportText: (text: string, suggestedName: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.inkprojExportText, text, suggestedName),
    readDoc: (workingDir: string, ref: DocRef): Promise<string> =>
      ipcRenderer.invoke(IPC.inkprojReadDoc, workingDir, ref),
    save: (workingDir: string, payload: InkprojSavePayload, srcPath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.inkprojSave, workingDir, payload, srcPath),
    attachDoc: (workingDir: string): Promise<DocRef | null> =>
      ipcRenderer.invoke(IPC.inkprojAttachDoc, workingDir),
    attachAsset: (workingDir: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.inkprojAttachAsset, workingDir),
    readAssetDataUri: (workingDir: string, relPath: string): Promise<string> =>
      ipcRenderer.invoke(IPC.inkprojReadAssetDataUri, workingDir, relPath),
    gcDocs: (workingDir: string, keep: string[]): Promise<string[]> =>
      ipcRenderer.invoke(IPC.inkprojGcDocs, workingDir, keep),
    pickExternal: (): Promise<PickedExternal | null> =>
      ipcRenderer.invoke(IPC.inkprojPickExternal),
    internalize: (workingDir: string): Promise<DocRef | null> =>
      ipcRenderer.invoke(IPC.inkprojInternalize, workingDir),
    close: (workingDir: string): Promise<void> => ipcRenderer.invoke(IPC.inkprojClose, workingDir)
  },

  /** Google Drive (cloud mode). All calls go through the main-process service. */
  drive: {
    listAccounts: (): Promise<DriveAccount[]> => ipcRenderer.invoke(IPC.driveListAccounts),
    connect: (): Promise<DriveAccount> => ipcRenderer.invoke(IPC.driveConnect),
    disconnect: (accountId: string): Promise<void> => ipcRenderer.invoke(IPC.driveDisconnect, accountId),
    list: (accountId: string, folderId: string): Promise<DriveNode[]> =>
      ipcRenderer.invoke(IPC.driveList, accountId, folderId),
    read: (
      accountId: string,
      fileId: string
    ): Promise<{ content: string; modifiedTime: string; name: string }> =>
      ipcRenderer.invoke(IPC.driveRead, accountId, fileId),
    write: (
      accountId: string,
      fileId: string,
      content: string,
      base: string
    ): Promise<{ modifiedTime: string } | { conflict: true }> =>
      ipcRenderer.invoke(IPC.driveWrite, accountId, fileId, content, base),
    create: (accountId: string, parentId: string, name: string, content: string): Promise<DriveNode> =>
      ipcRenderer.invoke(IPC.driveCreate, accountId, parentId, name, content),
    setCredentials: (id: string | null, secret: string | null): Promise<void> =>
      ipcRenderer.invoke(IPC.driveSetCredentials, id, secret)
  },

  /** main -> renderer: the connected Drive accounts changed. */
  onDriveAccountsChanged: (handler: () => void): (() => void) => {
    const l = (): void => handler()
    ipcRenderer.on(IPC.driveAccountsChanged, l)
    return () => ipcRenderer.removeListener(IPC.driveAccountsChanged, l)
  },

  /** Document templates (userData/templates). */
  listTemplates: (): Promise<TemplateEntry[]> => ipcRenderer.invoke(IPC.listTemplates),
  readTemplate: (id: string): Promise<string> => ipcRenderer.invoke(IPC.readTemplate, id),
  openTemplatesFolder: (): Promise<void> => ipcRenderer.invoke(IPC.openTemplatesFolder),

  /** External themes (userData/themes). */
  listThemes: (): Promise<ExternalTheme[]> => ipcRenderer.invoke(IPC.listThemes),
  readThemeCss: (id: string): Promise<ThemeCss> => ipcRenderer.invoke(IPC.readThemeCss, id),
  openThemesFolder: (): Promise<void> => ipcRenderer.invoke(IPC.openThemesFolder),
  /** The themes folder changed on disk (file added/edited/removed). */
  onThemesChanged: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IPC.themesChanged, listener)
    return () => ipcRenderer.removeListener(IPC.themesChanged, listener)
  },

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

  /** Apply the auto-hide-menu-bar preference to this window (Windows/Linux). */
  setMenuBarAutoHide: (hide: boolean): void => ipcRenderer.send(IPC.setMenuBarAutoHide, hide),

  /** Set the UI language; the main process rebuilds the native menu. */
  setLocale: (locale: Locale): void => ipcRenderer.send(IPC.setLocale, locale),

  /** Re-fire a menu channel (command palette) — round-trips through the main process. */
  triggerMenu: (channel: string, arg?: string): void =>
    ipcRenderer.send(IPC.triggerMenu, channel, arg),

  /** Open a URL in the default browser ("Search With…"). */
  openExternalUrl: (url: string): void => ipcRenderer.send(IPC.openExternalUrl, url),

  /** The OS asked us to open a file (file association); handler gets the path. */
  onOpenExternalFile: (handler: (path: string) => void): (() => void) => {
    const listener = (_e: unknown, path: string): void => handler(path)
    ipcRenderer.on(IPC.openExternalFile, listener)
    return () => ipcRenderer.removeListener(IPC.openExternalFile, listener)
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
