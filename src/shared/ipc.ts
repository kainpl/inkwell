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

/** A hunspell dictionary's two files, as text (empty strings on failure). */
export interface SpellDict {
  aff: string
  dic: string
}

/** One changed path in the working tree, for the Source Control panel. */
export interface GitChange {
  /** Path relative to the repo root (used for git ops and display). */
  path: string
  /** Index (staged) status char: M/A/D/R/C, or ' ' when not staged. */
  index: string
  /** Worktree (unstaged) status char: M/D/?, or ' ' when clean there. */
  worktree: string
}

/** Detailed working-tree state for the Source Control panel. */
export interface GitChanges {
  /** Current branch name (or a label like "HEAD (no branch)"), null if not a repo. */
  branch: string | null
  /** Commits ahead of the upstream (to push). */
  ahead: number
  /** Commits behind the upstream (to pull). */
  behind: number
  /** Files with staged changes (present in the index). */
  staged: GitChange[]
  /** Files with unstaged changes or untracked files. */
  unstaged: GitChange[]
}

/** Lightweight branch state for the status-bar indicator. */
export interface GitBranch {
  branch: string
  ahead: number
  behind: number
}

/** Result of a git mutation (stage/unstage/commit/push/pull). */
export interface GitResult {
  ok: boolean
  /** Trimmed stderr/message when `ok` is false. */
  error?: string
}

/** A document template found in the user's templates folder. */
export interface TemplateEntry {
  /** Filename without `.md` — also the template id. */
  id: string
  /** Display name. */
  name: string
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

// Drive types live in their (renderer-safe) own module; re-export for consumers
// that already import everything from `ipc`.
export type { DriveAccount, DriveNode } from './drive'

/** IPC channel names. One source of truth for both sides. */
export const IPC = {
  // renderer -> main (invoke/handle)
  openFileDialog: 'dialog:openFile',
  openFolderDialog: 'dialog:openFolder',
  readFile: 'fs:readFile',
  readFileAs: 'fs:readFileAs',
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
  // document templates (userData/templates)
  listTemplates: 'template:list',
  readTemplate: 'template:read',
  openTemplatesFolder: 'template:openFolder',
  // git status for the file tree (read-only)
  gitStatus: 'git:status',
  // git: detailed staged/unstaged changes for the Source Control panel
  gitChanges: 'git:changes',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitCommit: 'git:commit',
  gitPush: 'git:push',
  gitPull: 'git:pull',
  // git: lightweight branch + ahead/behind for the status-bar indicator
  gitBranch: 'git:branch',
  // note graph (wiki-link connections across the workspace)
  noteGraph: 'graph:notes',
  // inkproj mind-map / schema project files (extract + read; never writes in M1)
  inkprojOpen: 'inkproj:open',
  inkprojOpenDialog: 'inkproj:openDialog',
  inkprojCreateDialog: 'inkproj:createDialog',
  inkprojCreateUntitled: 'inkproj:createUntitled',
  inkprojSaveAs: 'inkproj:saveAs',
  inkprojGcDocs: 'inkproj:gcDocs',
  inkprojPickProjectFile: 'inkproj:pickProjectFile',
  inkprojPickImportFile: 'inkproj:pickImportFile',
  inkprojCreateFromImport: 'inkproj:createFromImport',
  inkprojExportMindMap: 'inkproj:exportMindMap',
  inkprojExportHtml: 'inkproj:exportHtml',
  inkprojExportText: 'inkproj:exportText',
  inkprojExportBinary: 'inkproj:exportBinary',
  inkprojReadDoc: 'inkproj:readDoc',
  inkprojSave: 'inkproj:save',
  inkprojAttachDoc: 'inkproj:attachDoc',
  inkprojAttachAsset: 'inkproj:attachAsset',
  inkprojReadAssetDataUri: 'inkproj:readAssetDataUri',
  inkprojPickExternal: 'inkproj:pickExternal',
  inkprojInternalize: 'inkproj:internalize',
  inkprojClose: 'inkproj:close',
  // google drive (cloud mode)
  driveListAccounts: 'drive:listAccounts',
  driveConnect: 'drive:connect',
  driveDisconnect: 'drive:disconnect',
  driveList: 'drive:list',
  driveRead: 'drive:read',
  driveWrite: 'drive:write',
  driveCreate: 'drive:create',
  driveSetCredentials: 'drive:setCredentials',
  // main -> renderer: the connected-accounts list changed
  driveAccountsChanged: 'drive:accountsChanged',
  // spell-check dictionaries (bundled en; others downloaded + cached)
  getSpellDict: 'spell:getDict',
  // main -> renderer: dictionary download progress (0–100; -1 done/error)
  spellProgress: 'spell:progress',
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
  menuNewProject: 'menu:newProject',
  menuOpenProject: 'menu:openProject',
  menuImportMindMap: 'menu:importMindMap',
  menuImportIntoProject: 'menu:importIntoProject',
  menuExportMindMap: 'menu:exportMindMap',
  menuExportHtmlProject: 'menu:exportHtmlProject',
  menuExportSchemaOpml: 'menu:exportSchemaOpml',
  menuExportSchemaMd: 'menu:exportSchemaMd',
  menuExportSchemaMm: 'menu:exportSchemaMm',
  menuExportSchemaMindnode: 'menu:exportSchemaMindnode',
  menuExportProjectPdf: 'menu:exportProjectPdf',
  menuExportProjectImage: 'menu:exportProjectImage',
  menuExportProjectInteractive: 'menu:exportProjectInteractive',
  menuPrintProject: 'menu:printProject',
  menuOpenFolder: 'menu:openFolder',
  menuSave: 'menu:save',
  menuSaveAs: 'menu:saveAs',
  menuSaveAll: 'menu:saveAll',
  menuToggleSidebar: 'menu:toggleSidebar',
  menuToggleOutline: 'menu:toggleOutline',
  menuOutlinePopover: 'menu:outlinePopover',
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
  menuReopenEncoding: 'menu:reopenEncoding',
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
  menuNoteGraph: 'menu:noteGraph',
  menuSourceControl: 'menu:sourceControl',
  menuConnectDrive: 'menu:connectDrive',
  menuNewFromTemplate: 'menu:newFromTemplate',
  menuStartSpeaking: 'menu:startSpeaking',
  menuStopSpeaking: 'menu:stopSpeaking',
  menuFormat: 'menu:format',
  // renderer -> main: re-fire a menu channel back to the renderer (command palette)
  triggerMenu: 'menu:trigger',
  // open document changed/removed on disk by another program
  fileChangedExternally: 'watch:changed',
  fileRemovedExternally: 'watch:removed',
  // renderer -> main: apply the auto-hide-menu-bar preference to the window
  setMenuBarAutoHide: 'app:setMenuBarAutoHide',
  // renderer -> main: set the UI language; main rebuilds the native menu
  setLocale: 'app:setLocale',
  // main -> renderer: open a file the OS launched/handed us (file association)
  openExternalFile: 'app:openExternalFile',
  // renderer -> main: open a URL in the default browser ("Search With…")
  openExternalUrl: 'app:openExternalUrl',
  // app lifecycle / unsaved-changes guard
  setDirty: 'app:setDirty',
  closeWindow: 'app:closeWindow',
  tryClose: 'app:tryClose'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
