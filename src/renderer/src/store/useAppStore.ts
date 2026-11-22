import { create } from 'zustand'
import type { FileNode } from '@shared/files'
import welcomeEn from '../welcome/Welcome.md?raw'
import welcomeUk from '../welcome/Вітаємо.md?raw'

import { readSettings, settingsKey, settingsKeys, type Settings } from '@renderer/lib/settings'

export interface DocState {
  path: string | null
  name: string
  content: string
  /** True when content differs from the last saved version. */
  dirty: boolean
}

interface AppState extends Settings {
  spellError: string | null
  preferencesOpen: boolean
  showPreferences: (open: boolean) => void
  configure: (settings: Partial<Settings>) => void
  documentEol: string
  savedContent: string
  draftGoal: number
  setGoal: (goal: number) => void
  // --- document ---
  doc: DocState
  documentId: number
  toggleSourceMode: () => void
  setContent: (content: string) => void
  loadDoc: (doc: { path: string | null; name: string; content: string }) => void
  markSaved: (content: string, path?: string, name?: string) => void
  newDoc: () => void

  // --- workspace ---
  root: FileNode | null
  setRoot: (node: FileNode | null) => void

  // --- ui ---
  toggleTheme: () => void
  sidebarOpen: boolean
  sidebarTab: 'folder' | 'outline'
  selectSidebarTab: (tab: 'folder' | 'outline') => void
  toggleSidebar: () => void
  toggleOutline: () => void
  toggleFocusMode: () => void
  toggleTypewriter: () => void
}

const EMPTY_DOC: DocState = {
  path: null,
  name: 'Untitled.md',
  content: '',
  dirty: false
}

const initial = readSettings()
const INITIAL_DOC: DocState = {
  ...EMPTY_DOC,
  name: initial.language === 'uk' ? 'Вітаємо.md' : 'Welcome.md',
  content: (initial.language === 'uk' ? welcomeUk : welcomeEn).replace(/\r\n?/g, '\n')
}

export const useAppStore = create<AppState>((set) => ({
  ...initial,
  doc: INITIAL_DOC,
  savedContent: INITIAL_DOC.content,
  documentEol: '\n',
  documentId: 0,
  spellError: null,
  preferencesOpen: false,
  showPreferences: (preferencesOpen) => set({ preferencesOpen }),
  configure: (patch) => set(patch),
  draftGoal: 0,
  setGoal: (goal) =>
    set((s) => {
      if (!s.doc.path) return { draftGoal: goal }
      const wordGoals = { ...s.wordGoals }
      if (goal) wordGoals[s.doc.path] = goal
      else delete wordGoals[s.doc.path]
      return { wordGoals }
    }),
  toggleSourceMode: () => set((s) => ({ sourceMode: !s.sourceMode })),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  setContent: (content) =>
    set((s) => ({ doc: { ...s.doc, content, dirty: content !== s.savedContent } })),
  loadDoc: ({ path, name, content }) =>
    set((s) => ({
      documentId: s.documentId + 1,
      documentEol: content.match(/\r\n?|\n/)?.[0] ?? (s.lineEnding === 'LF' ? '\n' : '\r\n'),
      doc: { path, name, content, dirty: false },
      savedContent: content,
      draftGoal: 0
    })),
  markSaved: (content, path, name) =>
    set((s) => {
      const goal = s.doc.path ? s.wordGoals[s.doc.path] : s.draftGoal
      let wordGoals = s.wordGoals
      if (path && path !== s.doc.path) {
        wordGoals = { ...wordGoals }
        if (goal) wordGoals[path] = goal
        else delete wordGoals[path]
      }
      return {
        wordGoals,
        savedContent: content,
        doc: {
          ...s.doc,
          dirty: s.doc.content !== content,
          path: path ?? s.doc.path,
          name: name ?? s.doc.name
        }
      }
    }),
  newDoc: () =>
    set((s) => ({
      documentId: s.documentId + 1,
      documentEol: s.lineEnding === 'LF' ? '\n' : '\r\n',
      savedContent: '',
      draftGoal: 0,
      doc: { ...EMPTY_DOC, name: s.language === 'en' ? 'Untitled.md' : 'Без назви.md' }
    })),
  root: null,
  setRoot: (root) => set(root ? { root, sidebarOpen: true, sidebarTab: 'folder' } : { root }),
  sidebarOpen: true,
  sidebarTab: 'folder',
  selectSidebarTab: (sidebarTab) => set({ sidebarOpen: true, sidebarTab }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleOutline: () =>
    set((s) => ({
      sidebarOpen: !s.sidebarOpen || s.sidebarTab !== 'outline',
      sidebarTab: 'outline'
    })),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  toggleTypewriter: () => set((s) => ({ typewriterMode: !s.typewriterMode }))
}))

useAppStore.subscribe((state, prev) => {
  if (!settingsKeys.some((k) => state[k] !== prev[k])) return
  localStorage.setItem(
    settingsKey,
    JSON.stringify(Object.fromEntries(settingsKeys.map((k) => [k, state[k]])))
  )
})
