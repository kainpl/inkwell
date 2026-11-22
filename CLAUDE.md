# CLAUDE.md

Guidance for working on **Inkwell** with Claude Code. Read this first.

## What this is

Inkwell is a desktop Markdown editor in the spirit of **Typora**: a *seamless
live preview*. There is no split "source | preview" pane. You type Markdown and
the syntax markers (`#`, `**`, `` ` ``, …) are hidden as you go, so the text
reads like a finished document. Move the caret onto a line and that line's
markers reappear (dimmed) for editing.

The editor supports source mode and rendered tables, tasks, images, math and diagrams.

## Stack

- **Tauri 2** hosts the desktop window. **Vite** serves and bundles the frontend.
- **React 18** + **TypeScript** in the renderer
- **TailwindCSS 3** for chrome styling (CSS variables drive theming)
- **CodeMirror 6** as the editing engine (this is where the Typora magic is)
- **Zustand** for renderer state

## Commands

```bash
npm install
npm run dev        # Tauri desktop with Vite HMR
npm run typecheck
npm test
npm run lint
npm run build:win  # package NSIS when requested (build:mac / build:linux on those platforms)
```

See README.md for native prerequisites.

## Project layout

```
src-tauri/                      Rust host, local-image protocol, CSP and capabilities
src/
  shared/files.ts               document and file tree types
  renderer/
    index.html                  Vite entry
    src/
      main.tsx                  installs the desktop adapter and mounts React
      desktop/                  dialogs, file access, menu, close guard
      App.tsx                   layout and theme
      index.css                 Tailwind layers, theme tokens, CodeMirror typography
      store/useAppStore.ts      Zustand store (doc, workspace, ui flags)
      lib/outline.ts            markdown heading parser for the outline panel
      components/
        TitleBar.tsx            top bar: doc name, sidebar/outline/theme toggles
        Sidebar.tsx FileTree.tsx  folder tree (lazy expand via window.api.readDir)
        OutlinePanel.tsx        headings list; click dispatches GOTO_EVENT
        StatusBar.tsx           word/char counts, focus/typewriter toggles
        Editor/
          Editor.tsx            mounts CodeMirror, syncs with store, handles goto
          markdownExtensions.ts assembles the CM extension stack
          livePreview.ts        *** the seamless-preview engine (most important) ***
          theme.ts              CM theme + syntax highlight facets
docs/                           ARCHITECTURE / FEATURES / ROADMAP / DECISIONS
```

## How the editor works (the important part)

`livePreview.ts` is a CodeMirror `StateField` that, on every doc/selection
change, walks the Lezer Markdown syntax tree over the document and
emits decorations:

1. **Heading lines** get a CSS class (`ink-h1`…`ink-h6`) → resized by `index.css`.
2. **Inline content** (`StrongEmphasis`, `Emphasis`, `Strikethrough`,
   `InlineCode`, `Link`) get styling classes.
3. **Syntax markers** (`HeaderMark`, `EmphasisMark`, `CodeMark`, …) are
   `Decoration.replace`d (hidden) **unless the caret is on that line**, in which
   case they are shown dimmed (`ink-mark`).

"Active line" detection lives in `activeLines()`. The styling itself is in
`index.css` under the `.cm-*` and `.ink-*` rules — colors come from CSS
variables so themes can swap them.

### Extending the engine

To add a new rendered element, the pattern is always:
1. Find the relevant Lezer node name (log `node.name` inside the `iterate`
   callback, or check `@lezer/markdown`).
2. Add a `Decoration.mark` (style) and/or `Decoration.replace` (hide markers).
3. Add the CSS class in `index.css`.
For block-level widgets (rendered images, math, mermaid, tables) use
`Decoration.replace({ widget })` with a `WidgetType` that renders into a DOM
node, and **only** replace when the line is inactive (so the source stays
editable when focused). This is the standard Typora-style approach.

## Conventions

- **Desktop APIs**: keep filesystem operations in `desktop/files.ts`, behind `window.api`.
  Declare native permissions for the main window in `src-tauri/capabilities/default.json`.
- **State**: all renderer state goes through `useAppStore`. Read with selectors
  (`useAppStore(s => s.x)`); call actions imperatively with
  `useAppStore.getState()` inside event handlers.
- **Styling**: Tailwind utilities for layout/chrome; semantic CSS classes
  (`.ink-*`) for editor content. Use theme tokens (`bg-paper`, `text-ink`,
  `border-line`, `text-accent`, …), never raw hex, so dark mode keeps working.
- **Security**: use dialog-scoped file access. Keep document links in the system browser.
- **No `any`**: strict TypeScript is on. Shared file types live in `src/shared/files.ts`.
