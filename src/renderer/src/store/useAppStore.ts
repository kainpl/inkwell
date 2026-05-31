import { create } from 'zustand'
import type { FileNode } from '@shared/ipc'

export interface DocState {
  path: string | null
  name: string
  content: string
  /** True when content differs from the last saved version. */
  dirty: boolean
}

interface AppState {
  // --- document ---
  doc: DocState
  setContent: (content: string) => void
  loadDoc: (doc: { path: string | null; name: string; content: string }) => void
  markSaved: (path?: string, name?: string) => void
  newDoc: () => void

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

const EMPTY_DOC: DocState = {
  path: null,
  name: 'Untitled.md',
  content: '',
  dirty: false
}

// The welcome document lives on disk (resources/Welcome.md) and is loaded from
// there on first launch (see `loadWelcome` in docActions). Start empty until it
// arrives so the welcome text isn't baked into the bundle.
const INITIAL_DOC: DocState = {
  path: null,
  name: 'Welcome.md',
  content: '',
  dirty: false
}

export const useAppStore = create<AppState>((set) => ({
  doc: INITIAL_DOC,

  setContent: (content) =>
    set((s) => ({ doc: { ...s.doc, content, dirty: content !== s.doc.content ? true : s.doc.dirty } })),

  loadDoc: ({ path, name, content }) =>
    set({ doc: { path, name, content, dirty: false } }),

  markSaved: (path, name) =>
    set((s) => ({
      doc: { ...s.doc, dirty: false, path: path ?? s.doc.path, name: name ?? s.doc.name }
    })),

  newDoc: () => set({ doc: { ...EMPTY_DOC } }),

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
