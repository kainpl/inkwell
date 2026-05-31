import { create } from 'zustand'
import type { FileNode } from '@shared/ipc'
import { type Tab, findByPath, isReplaceable, closeTab } from '@renderer/lib/tabsModel'
import { type PageSetup, loadPageSetup, savePageSetup } from '@renderer/lib/pageSetup'

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

  // --- ui ---
  theme: 'light' | 'dark'
  toggleTheme: () => void
  sidebarOpen: boolean
  /** Which sidebar tab is shown when it's open. */
  sidebarTab: 'files' | 'articles'
  setSidebarTab: (tab: 'files' | 'articles') => void
  outlineOpen: boolean
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

  theme: 'light',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

  sidebarOpen: true,
  sidebarTab: 'files',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  outlineOpen: false,
  focusMode: false,
  typewriterMode: false,
  sourceMode: false,
  formatBarOpen: true,
  autoSave: false,
  lineEnding: 'lf',
  insertFinalNewline: true,
  imageUploadCommand: '',
  pageSetup: loadPageSetup(),
  setPageSetup: (patch) =>
    set((s) => {
      const next = { ...s.pageSetup, ...patch }
      savePageSetup(next)
      return { pageSetup: next }
    }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleOutline: () => set((s) => ({ outlineOpen: !s.outlineOpen })),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  toggleTypewriter: () => set((s) => ({ typewriterMode: !s.typewriterMode })),
  toggleSourceMode: () => set((s) => ({ sourceMode: !s.sourceMode })),
  toggleFormatBar: () => set((s) => ({ formatBarOpen: !s.formatBarOpen })),
  toggleAutoSave: () => set((s) => ({ autoSave: !s.autoSave })),
  setLineEnding: (le) => set({ lineEnding: le }),
  toggleFinalNewline: () => set((s) => ({ insertFinalNewline: !s.insertFinalNewline })),
  setImageUploadCommand: (command) => set({ imageUploadCommand: command })
}))
