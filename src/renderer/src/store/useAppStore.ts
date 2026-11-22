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

export interface DocumentTab {
  id: number
  doc: DocState
  documentEol: string
  savedContent: string
  diskContent: string
  externalChange: boolean
  reloadVersion: number
  draftGoal: number
}

interface AppState extends Settings {
  spellError: string | null
  preferencesOpen: boolean
  showPreferences: (open: boolean) => void
  configure: (settings: Partial<Settings>) => void
  tabs: DocumentTab[]
  documentId: number
  activateTab: (id: number) => void
  removeTab: (id: number) => void
  setGoal: (goal: number) => void
  toggleSourceMode: () => void
  setContent: (content: string, id?: number) => void
  loadDoc: (doc: Omit<DocState, 'dirty'>) => number
  markSaved: (id: number, content: string, diskContent: string, path: string, name: string) => void
  receiveDiskContent: (content: string, discardEdits?: boolean, id?: number) => void
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

let nextId = 1

function documentTab(id: number, doc: Omit<DocState, 'dirty'>, fallbackEol: string): DocumentTab {
  return {
    id,
    doc: { ...doc, dirty: false },
    documentEol: doc.content.match(/\r\n?|\n/)?.[0] ?? fallbackEol,
    savedContent: doc.content,
    diskContent: doc.content,
    externalChange: false,
    reloadVersion: 0,
    draftGoal: 0
  }
}

export function activeTab(state: Pick<AppState, 'tabs' | 'documentId'>): DocumentTab {
  return state.tabs.find((tab) => tab.id === state.documentId)!
}

function updateTab(
  state: AppState,
  id: number,
  update: (tab: DocumentTab) => DocumentTab
): AppState | Pick<AppState, 'tabs'> {
  const index = state.tabs.findIndex((tab) => tab.id === id)
  if (index === -1) return state
  const tab = update(state.tabs[index])
  if (tab === state.tabs[index]) return state
  return { tabs: state.tabs.map((entry, i) => (i === index ? tab : entry)) }
}

const emptyTab = (state: AppState) =>
  documentTab(
    nextId++,
    {
      ...EMPTY_DOC,
      name: state.language === 'en' ? 'Untitled.md' : 'Без назви.md'
    },
    state.lineEnding === 'LF' ? '\n' : '\r\n'
  )

function openTab(state: AppState, tab: DocumentTab) {
  const current = activeTab(state)
  const replace =
    !current.doc.path && !current.doc.dirty && (current.id === 0 || !current.doc.content)
  return {
    tabs: replace
      ? state.tabs.map((entry) => (entry.id === current.id ? tab : entry))
      : [...state.tabs, tab],
    documentId: tab.id
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  ...initial,
  tabs: [documentTab(0, INITIAL_DOC, '\n')],
  documentId: 0,
  spellError: null,
  preferencesOpen: false,
  showPreferences: (preferencesOpen) => set({ preferencesOpen }),
  configure: (patch) => {
    const mode = patch.editorMode
    set(mode && mode !== 'source' ? { ...patch, lastFormattedMode: mode } : patch)
  },
  activateTab: (id) =>
    set((s) =>
      s.documentId !== id && s.tabs.some((tab) => tab.id === id) ? { documentId: id } : s
    ),
  removeTab: (id) =>
    set((s) => {
      const index = s.tabs.findIndex((tab) => tab.id === id)
      if (index === -1) return s
      const tabs = s.tabs.filter((tab) => tab.id !== id)
      if (!tabs.length) tabs.push(emptyTab(s))
      return {
        tabs,
        documentId: s.documentId === id ? tabs[Math.min(index, tabs.length - 1)].id : s.documentId
      }
    }),
  setGoal: (goal) =>
    set((s) => {
      const { doc } = activeTab(s)
      if (!doc.path) return updateTab(s, s.documentId, (tab) => ({ ...tab, draftGoal: goal }))
      const wordGoals = { ...s.wordGoals }
      if (goal) wordGoals[doc.path] = goal
      else delete wordGoals[doc.path]
      return { wordGoals }
    }),
  toggleSourceMode: () =>
    set((s) => ({
      editorMode: s.editorMode === 'source' ? s.lastFormattedMode : 'source'
    })),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  setContent: (content, id) =>
    set((s) =>
      updateTab(s, id ?? s.documentId, (tab) => ({
        ...tab,
        doc: { ...tab.doc, content, dirty: content !== tab.savedContent }
      }))
    ),
  loadDoc: (doc) => {
    const s = get()
    const existing = doc.path && s.tabs.find((tab) => tab.doc.path === doc.path)
    if (existing) {
      s.activateTab(existing.id)
      return existing.id
    }
    const tab = documentTab(nextId++, doc, s.lineEnding === 'LF' ? '\n' : '\r\n')
    set(openTab(s, tab))
    return tab.id
  },
  markSaved: (id, content, diskContent, path, name) =>
    set((s) => {
      const tab = s.tabs.find((entry) => entry.id === id)
      if (!tab) return s
      const goal = tab.doc.path ? s.wordGoals[tab.doc.path] : tab.draftGoal
      let wordGoals = s.wordGoals
      if (path !== tab.doc.path) {
        wordGoals = { ...wordGoals }
        if (goal) wordGoals[path] = goal
        else delete wordGoals[path]
      }
      return {
        ...updateTab(s, id, (entry) => ({
          ...entry,
          savedContent: content,
          diskContent,
          externalChange: false,
          doc: { ...entry.doc, path, name, dirty: entry.doc.content !== content }
        })),
        wordGoals
      }
    }),
  receiveDiskContent: (content, discardEdits = false, id) =>
    set((s) =>
      updateTab(s, id ?? s.documentId, (tab) => {
        if (
          !discardEdits &&
          (content === tab.diskContent || (tab.doc.dirty && content !== tab.doc.content))
        ) {
          const externalChange = content !== tab.diskContent
          return tab.externalChange === externalChange ? tab : { ...tab, externalChange }
        }
        return {
          ...tab,
          diskContent: content,
          savedContent: content,
          documentEol: content.match(/\r\n?|\n/)?.[0] ?? tab.documentEol,
          externalChange: false,
          reloadVersion: tab.reloadVersion + 1,
          doc: { ...tab.doc, content, dirty: false }
        }
      })
    ),
  newDoc: () =>
    set((s) => {
      const tab = emptyTab(s)
      return { tabs: [...s.tabs, tab], documentId: tab.id }
    }),
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
