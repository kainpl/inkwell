# CLAUDE.md

Guidance for working on **Inkwell** with Claude Code. Read this first.

## What this is

Inkwell is a desktop Markdown editor in the spirit of **Typora**: a *seamless
live preview*. There is no split "source | preview" pane. You type Markdown and
the syntax markers (`#`, `**`, `` ` ``, …) are hidden as you go, so the text
reads like a finished document. Move the caret onto a line and that line's
markers reappear (dimmed) for editing.

This repository is a **working scaffold**, not a finished product. The
architecture, IPC contract, editor pipeline, and UI shell are in place. Most
"rich" Markdown features (tables, images-as-widgets, math, diagrams, export)
are scaffolded or documented but not yet implemented. See `docs/ROADMAP.md`.

## Stack

- **Electron** (main + preload + renderer), wired by **electron-vite**
- **React 18** + **TypeScript** in the renderer
- **TailwindCSS 3** for chrome styling (CSS variables drive theming)
- **CodeMirror 6** as the editing engine (this is where the Typora magic is)
- **Zustand** for renderer state

## Commands

```bash
npm install        # install deps
npm run dev        # launch the app with HMR (electron-vite dev)
npm run build      # type-check + bundle main/preload/renderer into out/
npm run typecheck  # tsc for both node and web projects
npm run lint
npm run build:mac | build:win | build:linux   # package via electron-builder
```

Requires Node 18+.

## Project layout

```
src/
  shared/ipc.ts                 IPC channel names + shared types (single source of truth)
  main/
    index.ts                    BrowserWindow lifecycle, loads renderer
    menu.ts                     Native menu -> sends IPC events to renderer
    ipc/files.ts                fs handlers: open/read/save/readDir dialogs
  preload/
    index.ts                    contextBridge -> window.api (typed surface)
    index.d.ts                  global Window.api type
  renderer/
    index.html                  renderer entry (+ CSP)
    src/
      main.tsx                  React root
      App.tsx                   layout + theme + menu/file-op wiring
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

`livePreview.ts` is a CodeMirror `ViewPlugin` that, on every doc/selection
change, walks the Lezer Markdown syntax tree over the **visible range** and
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

- **IPC**: never hardcode channel strings. Add to `src/shared/ipc.ts` `IPC`
  object, expose through `preload/index.ts`, consume via `window.api`.
- **State**: all renderer state goes through `useAppStore`. Read with selectors
  (`useAppStore(s => s.x)`); call actions imperatively with
  `useAppStore.getState()` inside event handlers.
- **Styling**: Tailwind utilities for layout/chrome; semantic CSS classes
  (`.ink-*`) for editor content. Use theme tokens (`bg-paper`, `text-ink`,
  `border-line`, `text-accent`, …), never raw hex, so dark mode keeps working.
- **Security**: `contextIsolation: true`, `nodeIntegration: false`. The renderer
  touches the filesystem ONLY through `window.api`. Keep it that way.
- **No `any`**: `strict` is on. Prefer the shared types in `ipc.ts`.

## Good first tasks (see ROADMAP for the full list)

- Wire `Cmd/Ctrl+S` to actually persist (menu is wired; verify the round-trip).
- Render fenced code blocks with proper syntax highlight backgrounds.
- Implement task-list checkboxes you can click (`- [ ]` / `- [x]`).
- Add an image WidgetType so `![](path)` shows the image when the line is idle.
- Add an unsaved-changes guard before opening another file / closing the window.

## Gotchas

- The editor↔store sync in `Editor.tsx` guards against echo loops with
  `lastPushed`. When you add programmatic edits, route them through CM
  `dispatch`, not by mutating store content directly, or you'll fight the sync.
- `livePreview` iterates only `view.visibleRanges` for performance — don't
  assume the whole document is decorated.
- macOS uses `titleBarStyle: 'hiddenInset'`; the drag region is set on
  `TitleBar` via `WebkitAppRegion`. Buttons opt out with `no-drag`.
