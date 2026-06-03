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

- [x] **A1** `themes.ts`: `MINDMAP_THEMES` (sunset / forest / ocean / mono, `{ fill, text, line }[]` cycled by depth) + pure `applyTheme(doc, key)` (by-depth `setNodeData`; `clear` strips the theme keys). 2 tests.
- [x] **A2** `projectEditActions.applyMindmapTheme(key)`; `EditToolbar` 🎨 theme `<select>` (Clear + palettes).
- [x] **A3** `typecheck`/`lint` clean. Commit `feat(mindmap): mind-map themes (node palettes)`.

## Phase B — rich-text label flags + per-node notes

**Files:** modify `types.ts` (`bold/italic/underline`, `note`), `nodeStyleOps.ts`, `MindNode.tsx`, `OutlinePanel.tsx`, `NodeInspector.tsx`.

- [x] **B1** `NodeData.bold/italic/underline` (render-applied → rename-safe) + `note`. `nodeStyleOps.toggleLabelFlag` (tested).
- [x] **B2** `MindNode` + `OutlinePanel` render the label with `font-bold`/`italic`/`underline`; `NodeInspector` B / I / U toggles (`toggleLabel`) + a note textarea (`setNodeData({ note })`).
- [x] **B3** `MindNode`: a 📝 indicator (note as `title`) when `data.note` is set.
- [x] **B4** `typecheck`/`lint` clean. Commit `feat(mindmap): rich-text label flags + per-node notes`.

## Phase C — rendered markdown in the HTML export

**Files:** modify `lib/mindmap/exportHtml.ts` (+ test), `projectActions.ts`.

- [x] **C1** `HtmlExportInput.renderMd?`; when set, `renderDocBody` emits `<div class="ink-doc">…</div>` (inlining `src="assets/…"`) + `.ink-doc` markdown CSS. The `<pre>` path stays default. Test: `**bold**` → `<strong>` + asset inlined.
- [x] **C2** `projectActions.exportHtml` passes `renderMd: (m) => renderMarkdownBody(m, features)`.
- [x] **C3** `typecheck`/`lint` clean. Commit `feat(mindmap): rendered markdown in the HTML export`.

## Phase D — export project to PDF / PNG + Print

**Files:** modify `projectActions.ts` (extract `buildProjectHtml`), `shared/ipc.ts` (+ menu channels), `preload/index.ts` (`menuChannels`), `menu.ts`, `i18n`, `App.tsx`.

- [x] **D1** Extracted `buildProjectHtml()`; `exportProjectPdf` / `exportProjectImage` / `printProject` reuse the markdown editor's `window.api.exportPdf/exportImage/printDoc` (PDF/print use `pdfOptions(pageSetup)`). No new main code.
- [x] **D2** File → **Export Project as** ▸ submenu (HTML / PDF / PNG / Print); new channels + i18n en/uk/ru + `App.tsx` + `menuChannels`.
- [x] **D3** `typecheck`/`lint`/`build` green. Commit `feat(mindmap): export project to PDF / PNG + print`.

## Phase E — node ↔ doc deep-linking polish

**Files:** modify `OutlinePanel.tsx`, the doc-pane component (`DocPane`/`DocView`), `projectEditActions.ts` (a `revealNode` helper).

- [x] **E1** Outline: the 📄 indicator is a button → `openDocRef(id, firstDoc)`.
- [x] **E2** `DocBar`: a ⌖ chip with the open doc's node label → `revealNode(nodeId)` (expand ancestors + select + center).
- [x] **E3** `typecheck`/`lint`/`build` green. Commit `feat(mindmap): node ↔ doc deep-link polish`.

## Phase F — gate + QA

- [x] **F1** `npx vitest run` green (442; +4 across themes / nodeStyleOps / exportHtml); `typecheck`/`lint`/`build` clean.
- [x] **F2** QA: apply/clear a theme; B/I/U + a note on a node; export HTML (rendered md) + PDF/PNG/Print; outline 📄 opens a doc; doc-pane ⌖ reveals the node. *(accepted; pushed)*

## Self-review
- **Additive (D1):** theme colors, label flags, notes are node `data`; exports are read-only. ✓
- **Reuses:** ops, the markdown editor's PDF/PNG/print IPC + `offscreen`/`renderToImage`, `renderMarkdownBody`, `centerOnNode`, the inspector/toolbar. ✓
- **Deferred to M11 (largest / strategic):** layout-direction options (vertical / horizontal / left-right radial — a real layout+handles rework) and **AST → multi-view projections** (the convergence endgame). Both want QA iteration, not a blind sprint.
