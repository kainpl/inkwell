# 5.1 — Export & Print (foundation: HTML + PDF + Print)

Date: 2026-05-31 · Status: approved

First slice of Phase 5. Builds the `document → standalone HTML` engine (which all
later export outputs reuse) and ships **Export HTML**, **Print**, **Export PDF**,
and a full **Page Setup** dialog.

## Decisions (locked)

- **Renderer:** `markdown-it` + plugins (not a hand-rolled Lezer serializer).
- **Page Setup:** full dialog now (paper / margins / orientation / H1 break).
- **Theme:** always a clean **light "print" stylesheet** for both HTML-with-styles
  and PDF/print (one `export.css`).
- **Code syntax highlighting in export:** deferred (tracked, Phase 5.x).

## Architecture

- **Rendering runs in the renderer** (KaTeX / mermaid / DOMPurify are browser
  libs). New `lib/exportRender.ts`: `renderDocumentHtml(markdown, opts) → Promise<string>`
  returns a full `<!doctype html>…` string.
- **File + print operations run in main**: save dialogs, and an **offscreen
  `BrowserWindow`** loaded with the rendered HTML for `print()` / `printToPDF()`.
  The HTML is already fully static (math/mermaid pre-rendered to SVG, images
  embedded), so the offscreen window just displays it.

## The render engine (`lib/exportRender.ts`)

`markdown-it({ html: true, linkify: true })` with GFM (tables, strikethrough)
plus:

- **deps:** `markdown-it-footnote`, `markdown-it-task-lists`.
- **custom rules** (reuse existing deps, no new ones):
  - KaTeX inline `$…$` / block `$$…$$` via `katex.renderToString` (mirrors the
    regexes already in `livePreview.ts`).
  - mermaid ```` ```mermaid ```` → `renderMermaid()` (async) → inline `<svg>`.
  - emoji `:shortcode:` via `node-emoji`.
  - `==highlight==`, `~sub~` / `^sup^`, GitHub alerts `> [!NOTE]`, `[toc]`.
- **Images:** local `src` (relative / `file:` / `inkfile:`) → embedded as
  `data:` URI by `fetch('inkfile://…')` → base64; `http(s)`/`data` pass through.
- **Sanitize:** `DOMPurify.sanitize(body, { USE_PROFILES: { html: true, svg: true, mathMl: true } })`
  so KaTeX/mermaid survive.
- **Output:** `styled` option embeds `export.css` (+ KaTeX CSS) inline in
  `<head>`; otherwise body-only HTML.

Pure-ish and unit-testable (mermaid/image embedding injected/mocked).

## `export.css`

One self-contained light print stylesheet: typography, headings, code panels,
tables, blockquotes/alerts, images, footnotes. Derived from the app's light
tokens but standalone (no CM/editor chrome). `@media print { h1 { break-before:
page } }` gated by the H1-break option.

## Export HTML

`renderDocumentHtml(content, { styled })` → IPC `exportHtml(html, defaultName)`
→ main save dialog (`.html`) → write. Menu: **File → Export ▸ HTML (with styles)
/ HTML (without styles)**.

## Print + Export PDF + Page Setup

- Render print HTML (always `export.css`, light).
- IPC `printDoc(html, setup)` → offscreen window → `webContents.print()` (system
  dialog). IPC `exportPdf(html, setup, defaultName)` → `printToPDF(opts)` → save
  dialog → write.
- **Page Setup** = store state `pageSetup` (persisted to localStorage):
  `paper` (`A4` | `Letter` | `A5` | `Custom {w,h}` in mm), `margins` (preset or
  custom mm), `orientation` (`portrait` | `landscape`), `breakBeforeH1` (bool).
  Mapped to `printToPDF` options (`pageSize`, `margins`, `landscape`).
- UI: `components/PageSetupModal.tsx`. Menu: **File → Page Setup…**, **File →
  Print** (`Ctrl+P`).

## Modules

`lib/exportRender.ts`, `export.css`, `lib/exportActions.ts` (render + IPC glue),
`components/PageSetupModal.tsx`, store `pageSetup` + actions, `main/ipc/export.ts`,
menu + IPC channels + preload.

## Testing

- `exportRender` unit tests: headings, emphasis, lists, tasks, tables,
  footnotes, blockquote/alert, `==`/sub/sup, `[toc]`, inline/block math present;
  image embedding + mermaid mocked.
- `pageSetup` → `printToPDF` options mapping (pure).
- Offscreen `printToPDF` smoke-checked live (non-empty PDF buffer).

## Out of scope (later 5.x)

Copy as (5.2), Export Image (5.3), pandoc exports (5.4), export settings panel
(5.5), code syntax highlighting in export.
