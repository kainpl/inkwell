import { create } from 'zustand'
import type { FileNode } from '@shared/files'

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
  outlineOpen: boolean
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

const WELCOME = `# Welcome to Inkwell

A **seamless** Markdown editor — move your caret onto this line and the \`#\`
marker reappears so you can edit it.

## Try it

- *Italic*, **bold**, ~~strikethrough~~ and \`inline code\`
- A [link](https://typora.io) styled inline
- Headings resize as you type

## Lists

- Bullet at depth one
  - Nested item (hollow ◦ bullet)
    - Deeper still (▪ bullet)
- A long bullet that wraps onto a second line so you can see the hanging indent line up under the text rather than under the bullet

1. Ordered item one
2. Ordered item two
3. Ordered item three

> Markers hide on idle lines and reveal on the line you're editing.

### Next

Open a folder (\`Ctrl/⌘ Shift O\`) to browse files, or just start writing.
`

const INITIAL_DOC: DocState = {
  path: null,
  name: 'Welcome.md',
  content: WELCOME,
  dirty: false
}

const initial = readSettings()
if (initial.language === 'uk') {
  INITIAL_DOC.name = 'Вітаємо.md'
  INITIAL_DOC.content =
    '# Вітаємо в Inkwell\n\nПишіть у **Markdown**. Перемістіть курсор на рядок, щоб побачити його розмітку.\n\n## Спробуйте\n\n- *Курсив*, **жирний текст** і `код`\n- [ ] Позначте виконане завдання\n'
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
  setRoot: (root) => set({ root }),
  sidebarOpen: true,
  outlineOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleOutline: () => set((s) => ({ outlineOpen: !s.outlineOpen })),
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
