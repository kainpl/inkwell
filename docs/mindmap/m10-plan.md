# Milestone 10 — plan (schema editor: themes · rich text · notes · export & bridge polish)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Drain the remaining tractable schema-editor / interop backlog (blocks **B**, **C**,
**D**, **E**): mind-map **themes**, **rich-text label** flags, per-node **notes**, **rendered
markdown** in the HTML export, **PDF / PNG / Print** of a project, and **node ↔ doc** deep-link
polish.

**Architecture.** Themes/labels/notes are additive node `data` (D1) set through pure ops +
the inspector/toolbar. PDF/PNG/Print **reuse the markdown editor's existing main IPC**
(`exportPdf`/`exportImage`/`printDoc` take HTML + the `offscreen`/`renderToImage` helpers) —
no new main code; the renderer just feeds them `renderProjectHtml(...)`. Rendered markdown in
the export reuses `renderMarkdownBody` (sanitized fragment). Decisions: [`backlog.md`](backlog.md) §B/§C/§D.

**Conventions:** pure ops tested; reuse ops/IPC/render; commit per green group; one QA.

---

## Phase A — mind-map themes (node palettes)

**Files:** create `lib/mindmap/themes.ts` (+ test); modify `projectEditActions.ts`, `EditToolbar.tsx`.

- [ ] **A1** `themes.ts`: `MINDMAP_THEMES` (a few curated palettes — sunset / forest / ocean / mono, each a `{ fill, text, line }[]` cycled by depth) + pure `applyTheme(doc, key)` that walks `buildGraph(yjsToOutline(doc))` and `setNodeData` per node by `depth % palette.length`; `key === 'clear'` removes `fillColor`/`color`/`lineColor`. Test (colors by depth; clear strips).
- [ ] **A2** `projectEditActions.applyMindmapTheme(key)` (active doc + mark dirty). `EditToolbar`: a 🎨 theme `<select>` (Clear + the palettes).
- [ ] **A3** `typecheck`/`lint`. Commit `feat(mindmap): mind-map themes (node palettes)`.

## Phase B — rich-text label flags + per-node notes

**Files:** modify `types.ts` (`bold/italic/underline`, `note`), `nodeStyleOps.ts`, `MindNode.tsx`, `OutlinePanel.tsx`, `NodeInspector.tsx`.

- [ ] **B1** `NodeData`: `bold?`, `italic?`, `underline?` (label format flags, rename-safe — applied at render, not stored as HTML) and `note?: string`. `nodeStyleOps.toggleLabelFlag(doc, id, flag)` (test).
- [ ] **B2** `MindNode` + `OutlinePanel`: render the label with `font-bold`/`italic`/`underline` per flags. `NodeInspector`: **B / I / U** toggle buttons (call `toggleLabelFlag` via a `projectEditActions` wrapper) + a **note** textarea (`setNodeData({ note })`).
- [ ] **B3** `MindNode`: a 📝 indicator (with the note as `title`) when `data.note` is set.
- [ ] **B4** `typecheck`/`lint`. Commit `feat(mindmap): rich-text label flags + per-node notes`.

## Phase C — rendered markdown in the HTML export

**Files:** modify `lib/mindmap/exportHtml.ts` (+ test), `projectActions.ts`.

- [ ] **C1** `HtmlExportInput.renderMd?: (md: string) => string`. When present, `renderDocBody` emits `<div class="ink-doc">${renderMd(content)}</div>` (inlining `src="assets/…"` → data URI) instead of the escaped `<pre>`; add `.ink-doc` markdown CSS (h/p/ul/code/blockquote/img/table) to `STYLE`. The `<pre>` path stays the default (existing tests unchanged). Test: `**bold**` → `<strong>`.
- [ ] **C2** `projectActions.exportHtml` passes `renderMd: (md) => renderMarkdownBody(md, features)`.
- [ ] **C3** `typecheck`/`lint`. Commit `feat(mindmap): rendered markdown in the HTML export`.

## Phase D — export project to PDF / PNG + Print

**Files:** modify `projectActions.ts` (extract `buildProjectHtml`), `shared/ipc.ts` (+ menu channels), `preload/index.ts` (`menuChannels`), `menu.ts`, `i18n`, `App.tsx`.

- [ ] **D1** Extract `buildProjectHtml(): Promise<{ html; title } | null>` from `exportHtml` (graph + docs + assets + `renderMd`). `exportHtml` uses it; add `exportProjectPdf()` / `exportProjectImage()` / `printProject()` calling the existing `window.api.exportPdf/exportImage/printDoc` (PDF/print use `pdfOptions(pageSetup)`).
- [ ] **D2** `menu.ts`: fold the HTML item into a File → **Export Project as** ▸ submenu (HTML / PDF / PNG / Print). New menu channels + i18n en/uk/ru + `App.tsx` wiring + `menuChannels`.
- [ ] **D3** `typecheck`/`lint`/`build`. Commit `feat(mindmap): export project to PDF / PNG + print`.

## Phase E — node ↔ doc deep-linking polish

**Files:** modify `OutlinePanel.tsx`, the doc-pane component (`DocPane`/`DocView`), `projectEditActions.ts` (a `revealNode` helper).

- [ ] **E1** Outline: the 📄 indicator becomes a button → `openDocFor(id, firstDoc)` (open the node's doc).
- [ ] **E2** Doc pane: a header chip with the owning node's label → on click `select(nodeId)` + `centerOnNode(nodeId)` (reveal on the map). `projectEditActions.revealNode(id)`.
- [ ] **E3** `typecheck`/`lint`/`build`. Commit `feat(mindmap): node ↔ doc deep-link polish`.

## Phase F — gate + QA

- [ ] **F1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **F2** QA: apply/clear a theme; B/I/U + a note on a node; export HTML (rendered md) + PDF/PNG/Print; outline 📄 opens a doc; doc-pane chip reveals the node. Update `README.md` + `backlog.md`. Hand off; commit/push per OK.

## Self-review
- **Additive (D1):** theme colors, label flags, notes are node `data`; exports are read-only. ✓
- **Reuses:** ops, the markdown editor's PDF/PNG/print IPC + `offscreen`/`renderToImage`, `renderMarkdownBody`, `centerOnNode`, the inspector/toolbar. ✓
- **Deferred to M11 (largest / strategic):** layout-direction options (vertical / horizontal / left-right radial — a real layout+handles rework) and **AST → multi-view projections** (the convergence endgame). Both want QA iteration, not a blind sprint.
