# Mind‑map / schema‑editor — working docs

Knowledge base for the new architectural layer: a **schema / mind‑map editor** inside Inkwell, backed by a **single self‑contained project file** (custom‑extension ZIP holding a schema + bundled `.md` docs). We port the *idea* and the *format* from the **AiOffice / AI‑Протоколист (MindSuite)** ecosystem, decoupled from its cloud machinery.

Branch: `feat/mindmap`. Started 2026‑06‑02.

## Files

| File | What |
| --- | --- |
| [`reference-ecosystem.md`](reference-ecosystem.md) | **How the source works now** — the thing we’re porting. Accumulated analysis of the 3 reference repos: the `.mind-map` format, the React Flow editor, the node data model, persistence, export interop, the MindDoc design docs. |
| [`our-vision.md`](our-vision.md) | **What we build & how** — the `.inkproj` ZIP project, Inkwell integration, take/adapt/drop, locked decisions **D1–D13**, backlog. |
| [`m1-spec.md`](m1-spec.md) | **Milestone 1 spec** — the read‑only vertical slice (open `.inkproj` → render schema → click node → open doc). **Shipped.** |
| [`m1-plan.md`](m1-plan.md) | **Milestone 1 implementation plan** — 14 task‑by‑task steps (TDD). **Done.** |
| [`m2a-spec.md`](m2a-spec.md) | **Milestone 2a spec** — editing + save with a Yjs model (create/rename/delete/reparent, undo/redo, zip-back). |
| [`m2a-plan.md`](m2a-plan.md) | **Milestone 2a implementation plan** — 10 task-groups (TDD). **Done / shipped.** |
| [`m2b-spec.md`](m2b-spec.md) | **Milestone 2b spec** — cross-link editing (Phase A) + doc editing (Phase B): draw/retype/delete typed edges + custom types; attach/create/detach + an editable doc pane that saves into the bundle. |
| [`m2b-plan.md`](m2b-plan.md) | **Milestone 2b implementation plan** — Phase A (A1–A6) + Phase B (B1–B5), TDD. **Done / shipped.** |
| [`m2c-plan.md`](m2c-plan.md) | **Milestone 2c plan + design** — node styling · anchors UI · sibling reorder · external docs (Phases C1–C5). **Done / shipped.** |
| [`m3-plan.md`](m3-plan.md) | **Milestone 3 plan + design** — project lifecycle: New project · Import `.mind-map` · Export `.mind-map` (D10/D11 interop). **Done / shipped.** |
| [`m4-plan.md`](m4-plan.md) | **Milestone 4 plan + design** — export the active project to a single self-contained `.html` (shareable read-only artifact). **Code complete** (green gate); pending QA. |

## Source repos (read‑only, gitignored, under `temp/ref/`)

- `ai-office-main` — AiOffice main branch (no mind‑map).
- `ai-office-dev` — AiOffice dev branch (MindSuite integration + design docs).
- `ai-protocolist-dev` — **the real implementation** of the live mind‑map editor + `.mind-map` format.

## One‑line glossary

- **MindSuite** — the source product family (Protocolist, Stenographist, MindManager, MindDoc).
- **`.mind-map`** — shipped format: one Markdown file, nested bullets, per‑node `<!-- mindmap {…} -->` data bags.
- **MindDoc** — designed‑but‑unbuilt grander format (AST → markdown/visual projections).
- **`.inkproj`** (placeholder) — *our* project file: a ZIP bundling a schema + `docs/` + `assets/`.
- **Polysystem** — the source’s coupling (node == Drive folder == Telegram topic == Trello board); **we drop it**.

## Status

Research complete; **vision locked (D1–D13)**; **M1 shipped** on `feat/mindmap` (pushed to origin) — read-only slice (open `.inkproj` → React Flow schema + typed cross-links → click node → doc pane with anchor scroll) **+ projects open as tabs** (switch/close via TabBar). Manual acceptance passed.

**M2a shipped** on `feat/mindmap` — a per-tab **Yjs** model drives editing: create (Tab/Enter), inline rename (double-click/F2), delete, **drag-to-reparent**, **undo/redo** (Ctrl+Z / Shift+Z / Y), and **save back to the `.inkproj`** (Cmd+S / toolbar) with the unsaved-changes guard extended to project tabs. Green gate passed (vitest 395, typecheck, lint, build); manual QA accepted; pushed to origin.

**M2b shipped** on `feat/mindmap` — **cross-link editing** (draw via handle-drag, an Edge Inspector to retype/relabel/delete, first-class **custom link types** persisted in `manifest.json`) and **doc editing** (an **editable** doc pane buffered per-doc; **attach** copy-in via a file dialog, **create**, **detach**; one atomic Save writes schema + manifest + edited docs back into the bundle). Green gate passed (vitest 403, typecheck, lint, build); manual QA accepted; pushed to origin.

**M2c shipped** on `feat/mindmap` — four backlog slices: **node styling** (color/shape/icons/tags via a Node Inspector), **anchors UI** (insert `{#id}`/`^id` + node→anchor linking, D6), **sibling reordering** by drag, and **external docs** (attach/open/internalize with user-granted reads only, D7). Green gate passed (vitest 410, typecheck, lint, build); manual QA accepted; pushed to origin.

**M3 code-complete** on `feat/mindmap` — **project lifecycle**: **New Project** (pick a path → fresh `.inkproj` → open), **Import** a standalone `.mind-map` → new `.inkproj`, and **Export** the active schema → standalone `.mind-map` (D10/D11 interop). New/Import create a real file then reuse the open flow; Export reuses `outlineToMarkdown`. File-menu items wired across en/uk/ru. Green gate passed (vitest 411, typecheck, lint, build); manual QA accepted; pushed to origin.

**M4 code-complete** on `feat/mindmap` — **Export Project as HTML**: a pure generator turns the graph into a single self-contained `.html` (nested-outline tree with styled node chips, typed cross-links, and collapsible doc sections; click a node → jump to its doc). Inline CSS, no scripts, all text escaped; reuses `buildGraph`. Green gate passed (vitest 412, typecheck, lint, build). **Pending:** manual QA (plan §M4.3).
