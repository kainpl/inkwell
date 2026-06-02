import { create } from 'zustand'
import type { FileNode, ExternalTheme, GitBranch, DriveAccount } from '@shared/ipc'
import { type Tab, findByPath, isReplaceable, closeTab } from '@renderer/lib/tabsModel'
import { type PageSetup, loadPageSetup, savePageSetup } from '@renderer/lib/pageSetup'
import { type EditorFont, loadSettings, PANEL_MIN, PANEL_MAX } from '@renderer/lib/settings'
import { type Mode, hasBothEditions } from '@renderer/lib/themes'
import type { MarkdownFeatures } from '@renderer/lib/markdownFeatures'
import type { Locale } from '@shared/i18n'

export interface DocState {
  path: string | null
  name: string
  content: string
  /** True when content differs from the last saved version. */
  dirty: boolean
}

interface AppState {
  // --- documents / tabs ---
  /** Mirror of the active tab; existing consumers read the doc, not the list. */
  doc: DocState
  tabs: Tab[]
  activeId: string
  setContent: (content: string) => void
  /** Replace the active tab's content (file reload / draft recovery / welcome). */
  loadDoc: (doc: { path: string | null; name: string; content: string }) => void
  markSaved: (path?: string, name?: string) => void
  /** Open a file as a tab: focus an existing tab for the path, replace a pristine
   *  untitled tab, or append a new one. */
  openInTab: (file: { path: string | null; name: string; content: string }) => void
  newTab: () => void
  /** Append a path-less project tab (renders a `.inkproj` view); returns its id. */
  openProjectTab: (name: string) => string
  activateTab: (id: string) => void
  /** Remove a tab; never leaves zero tabs (spawns a fresh untitled if needed). */
  removeTab: (id: string) => void
  /** Collapse to a single fresh untitled tab (used by Close Folder). */
  resetTabs: () => void
  /** Update the path+name of any open tab pointing at `oldPath` (rename / move). */
  updateTabPath: (oldPath: string, newPath: string, name: string) => void

  // --- workspace ---
  root: FileNode | null
  setRoot: (node: FileNode | null) => void
  /** Git status per file (absolute `/`-path → status char); see lib/git.ts. */
  gitStatus: Record<string, string>
  setGitStatus: (status: Record<string, string>) => void
  /** Current branch + ahead/behind for the status-bar indicator (null = not a repo). */
  gitBranch: GitBranch | null
  setGitBranch: (b: GitBranch | null) => void
  /** Connected Google Drive accounts (see lib/drive.ts). */
  driveAccounts: DriveAccount[]
  setDriveAccounts: (a: DriveAccount[]) => void

  // --- ui ---
  /** UI language (chrome + native menu); persisted via settingsSync. */
  locale: Locale
  setLocale: (locale: Locale) => void
  /** Active theme id (see lib/themes.ts). */
  theme: string
  /** Active edition of the theme. */
  mode: Mode
  setMode: (mode: Mode) => void
  /** Flip the edition (no-op if the theme has only one). */
  toggleMode: () => void
  sidebarOpen: boolean
  /** Which sidebar tab is shown when it's open. */
  sidebarTab: 'files' | 'outline'
  setSidebarTab: (tab: 'files' | 'outline') => void
  focusMode: boolean
  typewriterMode: boolean
  sourceMode: boolean
  formatBarOpen: boolean
  /** Auto-save the document a short while after edits stop (only when it has a path). */
  autoSave: boolean
  /** Line ending written to disk on save. */
  lineEnding: 'lf' | 'crlf'
  /** Ensure exactly one trailing newline on save. */
  insertFinalNewline: boolean
  /** Shell command for image upload (Typora-style); configured in Preferences. */
  imageUploadCommand: string
  /** Print / Export-PDF page setup (persisted to localStorage). */
  pageSetup: PageSetup
  setPageSetup: (patch: Partial<PageSetup>) => void
  // --- appearance / typography (persisted via settingsSync) ---
  setTheme: (theme: string) => void
  /** Themes discovered in the user's themes folder (see lib/themeApply.ts). */
  externalThemes: ExternalTheme[]
  setExternalThemes: (themes: ExternalTheme[]) => void
  editorFont: EditorFont
  editorFontSize: number
  editorLineHeight: number
  contentWidth: number
  /** Pixel width of the resizable sidebar (drag handle + persisted). */
  sidebarWidth: number
  setEditorFont: (font: EditorFont) => void
  setEditorFontSize: (px: number) => void
  setEditorLineHeight: (lh: number) => void
  setContentWidth: (px: number) => void
  setSidebarWidth: (px: number) => void
  /** Embed local images as data: URIs in exported HTML. */
  embedImages: boolean
  setEmbedImages: (on: boolean) => void
  /** Typographic substitution as you type (quotes/dashes/ellipsis). */
  smartPunctuation: boolean
  setSmartPunctuation: (on: boolean) => void
  /** Spell check (persisted). */
  spellCheck: boolean
  setSpellCheck: (on: boolean) => void
  spellLanguages: string[]
  toggleSpellLanguage: (lang: string) => void
  learnedWords: string[]
  addLearnedWord: (word: string) => void
  /** "Search With…" context-menu services. */
  searchServices: { name: string; url: string }[]
  setSearchServices: (services: { name: string; url: string }[]) => void
  /** Custom keyboard shortcuts: command id → CodeMirror key. */
  keyBindings: Record<string, string>
  setKeyBinding: (commandId: string, key: string | null) => void
  /** BYO Google OAuth client id + secret (persisted; empty ⇒ built-in). */
  driveClientId: string
  setDriveClientId: (id: string) => void
  driveClientSecret: string
  setDriveClientSecret: (secret: string) => void
  /** Bumped when the active spell checker (re)loads, to retrigger decoration. */
  spellVersion: number
  bumpSpellVersion: () => void
  /** Export CSS: built-in print stylesheet vs the active editor theme. */
  exportStyle: 'default' | 'theme'
  setExportStyle: (style: 'default' | 'theme') => void
  /** Toggleable Markdown features (live editor + export). */
  markdownFeatures: MarkdownFeatures
  setMarkdownFeature: (key: keyof MarkdownFeatures, on: boolean) => void
  /** Auto-hide the native menu bar (Windows/Linux). */
  autoHideMenuBar: boolean
  setAutoHideMenuBar: (on: boolean) => void
  toggleSidebar: () => void
  toggleOutline: () => void
  toggleFocusMode: () => void
  toggleTypewriter: () => void
  toggleSourceMode: () => void
  toggleFormatBar: () => void
  toggleAutoSave: () => void
  setLineEnding: (le: 'lf' | 'crlf') => void
  toggleFinalNewline: () => void
  setImageUploadCommand: (command: string) => void
}

let tabCounter = 0
const genId = (): string => `tab-${++tabCounter}`

const docOf = (t: Tab): DocState => ({
  path: t.path,
  name: t.name,
  content: t.content,
  dirty: t.dirty
})

const untitled = (): Tab => ({
  id: genId(),
  path: null,
  name: 'Untitled.md',
  content: '',
  dirty: false
})

// First tab is the welcome placeholder; its text is loaded from disk on launch
// (see `loadWelcome` in docActions) so the welcome content isn't baked in.
const firstTab: Tab = { id: genId(), path: null, name: 'Welcome.md', content: '', dirty: false }

// Preferences-managed settings, seeded from localStorage (persisted by settingsSync).
const s0 = loadSettings()

/** Keep a dragged panel width within the allowed range. */
const clampPanel = (px: number): number => Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(px)))

export const useAppStore = create<AppState>((set) => ({
  doc: docOf(firstTab),
  tabs: [firstTab],
  activeId: firstTab.id,

  setContent: (content) =>
    set((s) => {
      const dirty = content !== s.doc.content ? true : s.doc.dirty
      const doc = { ...s.doc, content, dirty }
      return { doc, tabs: s.tabs.map((t) => (t.id === s.activeId ? { ...t, content, dirty } : t)) }
    }),

  loadDoc: ({ path, name, content }) =>
    set((s) => {
      const doc: DocState = { path, name, content, dirty: false }
      return { doc, tabs: s.tabs.map((t) => (t.id === s.activeId ? { ...t, ...doc } : t)) }
    }),

  markSaved: (path, name) =>
    set((s) => {
      const doc = { ...s.doc, dirty: false, path: path ?? s.doc.path, name: name ?? s.doc.name }
      return {
        doc,
        tabs: s.tabs.map((t) =>
          t.id === s.activeId ? { ...t, path: doc.path, name: doc.name, dirty: false } : t
        )
      }
    }),

  openInTab: (file) =>
    set((s) => {
      const existing = findByPath(s.tabs, file.path)
      if (existing) return { activeId: existing.id, doc: docOf(existing) }
      const active = s.tabs.find((t) => t.id === s.activeId)
      if (isReplaceable(active)) {
        const replaced: Tab = { id: active!.id, ...file, dirty: false }
        return { tabs: s.tabs.map((t) => (t.id === active!.id ? replaced : t)), doc: docOf(replaced) }
      }
      const t: Tab = { id: genId(), ...file, dirty: false }
      return { tabs: [...s.tabs, t], activeId: t.id, doc: docOf(t) }
    }),

  newTab: () =>
    set((s) => {
      const t = untitled()
      return { tabs: [...s.tabs, t], activeId: t.id, doc: docOf(t) }
    }),

  openProjectTab: (name) => {
    const id = genId()
    set((s) => {
      const t: Tab = { id, path: null, name, content: '', dirty: false, kind: 'project' }
      return { tabs: [...s.tabs, t], activeId: id, doc: docOf(t) }
    })
    return id
  },

  activateTab: (id) =>
    set((s) => {
      const t = s.tabs.find((x) => x.id === id)
      return t ? { activeId: id, doc: docOf(t) } : {}
    }),

  removeTab: (id) =>
    set((s) => {
      const res = closeTab(s.tabs, id)
      if (res.tabs.length === 0) {
        const fresh = untitled()
        return { tabs: [fresh], activeId: fresh.id, doc: docOf(fresh) }
      }
      if (id !== s.activeId) return { tabs: res.tabs }
      const next = res.tabs.find((t) => t.id === res.activeId)!
      return { tabs: res.tabs, activeId: res.activeId!, doc: docOf(next) }
    }),

  resetTabs: () =>
    set(() => {
      const t = untitled()
      return { tabs: [t], activeId: t.id, doc: docOf(t) }
    }),

  updateTabPath: (oldPath, newPath, name) =>
    set((s) => {
      const tabs = s.tabs.map((t) => (t.path === oldPath ? { ...t, path: newPath, name } : t))
      const active = tabs.find((t) => t.id === s.activeId)
      return { tabs, doc: active ? { ...s.doc, path: active.path, name: active.name } : s.doc }
    }),

  root: null,
  setRoot: (node) => set({ root: node }),
  gitStatus: {},
  setGitStatus: (gitStatus) => set({ gitStatus }),
  gitBranch: null,
  setGitBranch: (gitBranch) => set({ gitBranch }),
  driveAccounts: [],
  setDriveAccounts: (driveAccounts) => set({ driveAccounts }),

  locale: s0.locale,
  setLocale: (locale) => set({ locale }),
  theme: s0.theme,
  mode: s0.mode,
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) =>
      hasBothEditions(s.theme, s.externalThemes)
        ? { mode: s.mode === 'dark' ? 'light' : 'dark' }
        : {}
    ),
  setTheme: (theme) => set({ theme }),
  externalThemes: [],
  setExternalThemes: (externalThemes) => set({ externalThemes }),

  sidebarOpen: true,
  sidebarTab: 'files',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  focusMode: false,
  typewriterMode: false,
  sourceMode: false,
  formatBarOpen: s0.formatBarOpen,
  autoSave: s0.autoSave,
  lineEnding: s0.lineEnding,
  insertFinalNewline: s0.insertFinalNewline,
  imageUploadCommand: s0.imageUploadCommand,
  editorFont: s0.editorFont,
  editorFontSize: s0.editorFontSize,
  editorLineHeight: s0.editorLineHeight,
  contentWidth: s0.contentWidth,
  sidebarWidth: s0.sidebarWidth,
  embedImages: s0.embedImages,
  smartPunctuation: s0.smartPunctuation,
  spellCheck: s0.spellCheck,
  spellLanguages: s0.spellLanguages,
  learnedWords: s0.learnedWords,
  searchServices: s0.searchServices,
  keyBindings: s0.keyBindings,
  driveClientId: s0.driveClientId,
  driveClientSecret: s0.driveClientSecret,
  spellVersion: 0,
  exportStyle: s0.exportStyle,
  markdownFeatures: s0.markdownFeatures,
  autoHideMenuBar: s0.autoHideMenuBar,
  setEditorFont: (font) => set({ editorFont: font }),
  setEditorFontSize: (px) => set({ editorFontSize: px }),
  setEditorLineHeight: (lh) => set({ editorLineHeight: lh }),
  setContentWidth: (px) => set({ contentWidth: px }),
  setSidebarWidth: (px) => set({ sidebarWidth: clampPanel(px) }),
  setEmbedImages: (on) => set({ embedImages: on }),
  setSmartPunctuation: (on) => set({ smartPunctuation: on }),
  setSpellCheck: (on) => set({ spellCheck: on }),
  toggleSpellLanguage: (lang) =>
    set((s) => ({
      spellLanguages: s.spellLanguages.includes(lang)
        ? s.spellLanguages.filter((l) => l !== lang)
        : [...s.spellLanguages, lang]
    })),
  addLearnedWord: (word) =>
    set((s) => ({
      learnedWords: s.learnedWords.includes(word) ? s.learnedWords : [...s.learnedWords, word]
    })),
  bumpSpellVersion: () => set((s) => ({ spellVersion: s.spellVersion + 1 })),
  setSearchServices: (searchServices) => set({ searchServices }),
  setKeyBinding: (commandId, key) =>
    set((s) => {
      const next = { ...s.keyBindings }
      if (key) next[commandId] = key
      else delete next[commandId]
      return { keyBindings: next }
    }),
  setDriveClientId: (driveClientId) => set({ driveClientId }),
  setDriveClientSecret: (driveClientSecret) => set({ driveClientSecret }),
  setExportStyle: (exportStyle) => set({ exportStyle }),
  setMarkdownFeature: (key, on) =>
    set((s) => ({ markdownFeatures: { ...s.markdownFeatures, [key]: on } })),
  setAutoHideMenuBar: (on) => set({ autoHideMenuBar: on }),
  pageSetup: loadPageSetup(),
  setPageSetup: (patch) =>
    set((s) => {
      const next = { ...s.pageSetup, ...patch }
      savePageSetup(next)
      return { pageSetup: next }
    }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  // The outline now lives as a sidebar tab: show it (opening the sidebar), or
  // flip back to the file tree if it's already the active tab.
  toggleOutline: () =>
    set((s) =>
      s.sidebarOpen && s.sidebarTab === 'outline'
        ? { sidebarTab: 'files' }
        : { sidebarOpen: true, sidebarTab: 'outline' }
    ),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  toggleTypewriter: () => set((s) => ({ typewriterMode: !s.typewriterMode })),
  toggleSourceMode: () => set((s) => ({ sourceMode: !s.sourceMode })),
  toggleFormatBar: () => set((s) => ({ formatBarOpen: !s.formatBarOpen })),
  toggleAutoSave: () => set((s) => ({ autoSave: !s.autoSave })),
  setLineEnding: (le) => set({ lineEnding: le }),
  toggleFinalNewline: () => set((s) => ({ insertFinalNewline: !s.insertFinalNewline })),
  setImageUploadCommand: (command) => set({ imageUploadCommand: command })
}))
