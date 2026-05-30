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
  outlineOpen: boolean
  focusMode: boolean
  typewriterMode: boolean
  formatBarOpen: boolean
  toggleSidebar: () => void
  toggleOutline: () => void
  toggleFocusMode: () => void
  toggleTypewriter: () => void
  toggleFormatBar: () => void
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
- <u>Underline</u>, ==highlight==, H~2~O, x^2^ (and a hidden comment <!-- like this -->)
- Emoji shortcodes like :tada: :rocket: :coffee: render inline

## Lists

- Bullet at depth one
  - Nested item (hollow ◦ bullet)
    - Deeper still (▪ bullet)
- A long bullet that wraps onto a second line so you can see the hanging indent line up under the text rather than under the bullet

1. Ordered item one
2. Ordered item two
3. Ordered item three

## Tasks

- [x] Hide markdown markers on idle lines
- [ ] Click this box to toggle it
- [ ] Render tables as widgets

> Markers hide on idle lines and reveal on the line you're editing.
>
> > Quotes can nest, too.

---

## Links

Ctrl/⌘-click to follow: an [inline link](https://github.com), a
[reference link][repo], an autolink <https://typora.io>, a bare URL
https://example.com, and an internal jump to the [Tasks](#tasks) heading.

[repo]: https://github.com/kainpl/inkwell

### Next

Open a folder (\`Ctrl/⌘ Shift O\`) to browse files, or just start writing.
`

const INITIAL_DOC: DocState = {
  path: null,
  name: 'Welcome.md',
  content: WELCOME,
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
  outlineOpen: false,
  focusMode: false,
  typewriterMode: false,
  formatBarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleOutline: () => set((s) => ({ outlineOpen: !s.outlineOpen })),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  toggleTypewriter: () => set((s) => ({ typewriterMode: !s.typewriterMode })),
  toggleFormatBar: () => set((s) => ({ formatBarOpen: !s.formatBarOpen }))
}))
