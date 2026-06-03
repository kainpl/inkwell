# Mind‑map / schema‑editor — working docs

Knowledge base for the new architectural layer: a **schema / mind‑map editor** inside Inkwell, backed by a **single self‑contained project file** (custom‑extension ZIP holding a schema + bundled `.md` docs). We port the *idea* and the *format* from the **AiOffice / AI‑Протоколист (MindSuite)** ecosystem, decoupled from its cloud machinery.

Branch: `feat/mindmap`. Started 2026‑06‑02.

## Files

| File | What |
| --- | --- |
| [`reference-ecosystem.md`](reference-ecosystem.md) | **How the source works now** — the thing we’re porting. Accumulated analysis of the 3 reference repos: the `.mind-map` format, the React Flow editor, the node data model, persistence, export interop, the MindDoc design docs. |
| [`our-vision.md`](our-vision.md) | **What we build & how** — the `.inkproj` ZIP project, Inkwell integration, take/adapt/drop, locked decisions **D1–D13**, backlog. |
| [`backlog.md`](backlog.md) | **Consolidated backlog** — everything parked, from our specs + a survey of Protocolist / AiOffice / MindNode; tagged source · effort · priority. Strategy: max the schema editor now, then bridge schema⟷markdown (Outline view) on top of the project. |
| [`m7-plan.md`](m7-plan.md) | **Milestone 7** — backlog block A: node search + reveal · keyboard navigation · multi-select + batch · tag-highlight · canvas focus mode · (E) hotkeys help / quick-entry / breadcrumb. **Done / shipped.** |
| [`m8-plan.md`](m8-plan.md) | **Milestone 8** — Outline view (schema⟷markdown bridge, block C): Map/Outline/Split, edit the schema as an indented outline over the same Yjs model. **Done / shipped.** |
| [`m9-plan.md`](m9-plan.md) | **Milestone 9** — schema visuals + exports (blocks B & D): export OPML/Markdown/FreeMind · interactive tasks · more node shapes (cloud/hexagon/octagon) · subtree frames. **Done / shipped.** |
| [`m10-plan.md`](m10-plan.md) | **Milestone 10** — themes · rich-text label flags · per-node notes · rendered-markdown HTML export · project PDF/PNG/Print · node↔doc deep-link polish (blocks B/C/D/E). **Done / shipped.** |
| [`m11-plan.md`](m11-plan.md) | **Milestone 11** — layout direction (horizontal/vertical) · table view (AST projection) · project autosave + shrink-guard · canvas virtualization (blocks B/C/E/G). **Done / shipped.** |
| [`m12-plan.md`](m12-plan.md) | **Milestone 12** — many-to-many node↔doc links: link an existing bundle doc to another node · surface docs shared across nodes · a project docs panel (block E). The tree is the core/SSOT; docs attach M:N (no canonical-AST merge). **Done / shipped.** |
| [`m13-plan.md`](m13-plan.md) | **Milestone 13** — all of backlog §E: untitled New project · orphaned-doc GC · save-failure surfacing + retry · project notes in manifest · schema history/versions · cross-`.inkproj` links · canvas image thumbnails. **Done / shipped.** |
| [`m14-plan.md`](m14-plan.md) | **Milestone 14** — the rest of backlog §D: `.xmind` import · import into an open project (merge) · two-tier node text on import · interactive HTML export · `.mindnode` writer (export). **Done / shipped.** |
| [`m15-plan.md`](m15-plan.md) | **Milestone 15** — the rest of backlog §B: line/embedded shapes · task subtree progress rollup · rich-text labels (font size/family + inline markdown) · custom theme palettes · left+right radial layout. **Done / shipped.** |
| [`m16-plan.md`](m16-plan.md) | **Milestone 16** — the small leftovers: slides projection (§C) · auto-collapse for large maps (§G). ELK auto-layout deferred (heavy dependency). **Done / shipped.** |
| [`m17-plan.md`](m17-plan.md) | **Milestone 17** — ELK auto-layout: `elkjs` as an opt-in alternative engine (Banded ⟷ ELK toggle; async with a banded fallback). The last backlog item (§G). **Done / shipped.** |
| [`m1-spec.md`](m1-spec.md) | **Milestone 1 spec** — the read‑only vertical slice (open `.inkproj` → render schema → click node → open doc). **Shipped.** |
| [`m1-plan.md`](m1-plan.md) | **Milestone 1 implementation plan** — 14 task‑by‑task steps (TDD). **Done.** |
| [`m2a-spec.md`](m2a-spec.md) | **Milestone 2a spec** — editing + save with a Yjs model (create/rename/delete/reparent, undo/redo, zip-back). |
| [`m2a-plan.md`](m2a-plan.md) | **Milestone 2a implementation plan** — 10 task-groups (TDD). **Done / shipped.** |
| [`m2b-spec.md`](m2b-spec.md) | **Milestone 2b spec** — cross-link editing (Phase A) + doc editing (Phase B): draw/retype/delete typed edges + custom types; attach/create/detach + an editable doc pane that saves into the bundle. |
| [`m2b-plan.md`](m2b-plan.md) | **Milestone 2b implementation plan** — Phase A (A1–A6) + Phase B (B1–B5), TDD. **Done / shipped.** |
| [`m2c-plan.md`](m2c-plan.md) | **Milestone 2c plan + design** — node styling · anchors UI · sibling reorder · external docs (Phases C1–C5). **Done / shipped.** |
| [`m3-plan.md`](m3-plan.md) | **Milestone 3 plan + design** — project lifecycle: New project · Import `.mind-map` · Export `.mind-map` (D10/D11 interop). **Done / shipped.** |
| [`m4-plan.md`](m4-plan.md) | **Milestone 4 plan + design** — export the active project to a single self-contained `.html` (shareable read-only artifact). **Done / shipped.** |
| [`m5-plan.md`](m5-plan.md) | **Milestone 5** — import hub (`.mind-map`/`.mind-doc`/FreeMind `.mm`/OPML/MD/TXT/JSON **+ `.mindnode`**) + image assets. **Code-complete** (pending QA). |
| [`m6-plan.md`](m6-plan.md) | **Milestone 6** — canvas polish: non-overlapping multi-root layout + live drag drop-ghost. **Code complete** (pending QA). |

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

**M4 code-complete** on `feat/mindmap` — **Export Project as HTML**: a pure generator turns the graph into a single self-contained `.html` (nested-outline tree with styled node chips, typed cross-links, and collapsible doc sections; click a node → jump to its doc). Inline CSS, no scripts, all text escaped; reuses `buildGraph`. Green gate passed (vitest 412, typecheck, lint, build); manual QA accepted; pushed to origin.

**M5 + M6 code-complete** on `feat/mindmap` (pending QA). **M5** — a multi-format **import hub** (`.mind-map`/`.mind-doc`/FreeMind `.mm`/OPML/`.md`/`.txt`/`.json` + **`.mindnode`** binary protobuf, all adapted from the source's importer per §1a) + **image assets** (attach into `assets/`, inlined as base64 in the HTML export). **M6** — non-overlapping **multi-root layout** + a live drag **drop-ghost** (shared pure `resolveDrop`). Green gate passed (vitest 423, typecheck, lint, build).

**M7 shipped** on `feat/mindmap` — backlog **block A** (navigation): node search + reveal (`Ctrl+Shift+F`), keyboard navigation (arrows / `1–9` expand-to-level / `Home`), multi-select + batch (color/tag/delete), tag-highlight + canvas focus mode, plus **E** (hotkeys help `?`, ⚡ quick-entry, breadcrumb). Manual QA accepted.

**M8 shipped** on `feat/mindmap` — **Outline view** (the first schema⟷markdown bridge, block C): a Map / Outline / Split toggle; the schema edits as an indented outline (rename, Enter/Tab/Shift+Tab/Backspace, ↑/↓) over the **same Yjs model**, so map and outline stay in lockstep (no text round-trip). Manual QA accepted.

**M9 shipped** on `feat/mindmap` — schema visuals + interop (blocks **B** & **D**): **export OPML / Markdown / FreeMind `.mm`** (pure generators, each re-importable), **interactive tasks** (click to cycle `taskStatus`), **more node shapes** (cloud + clip-path hexagon/octagon), and **subtree frames** (bracket / underline). Green gate passed (vitest 438, typecheck, lint, build); manual QA accepted.

**M10 shipped** on `feat/mindmap` — schema editor polish (blocks **B/C/D/E**): **mind-map themes** (curated node palettes applied by depth), **rich-text label flags** (bold/italic/underline, render-applied) + **per-node notes**, **rendered markdown** in the HTML export (`.ink-doc`), **project export to PDF / PNG + Print** (reusing the markdown editor's export IPC), and **node ↔ doc deep-link polish** (outline 📄 opens a doc; a ⌖ chip reveals the doc's node). Green gate passed (vitest 442, typecheck, lint, build); manual QA accepted. *Deferred to M11: layout-direction options + AST multi-view projections.*

**M11 shipped** on `feat/mindmap` — resilience, perf & two M11-headline items (blocks **B/C/E/G**): **project autosave + a shrink-guard** (auto-saves the active dirty project; refuses to *auto*-overwrite a non-trivial map with a stub), a **table view** (a third projection of the one model), **layout direction** (horizontal → / vertical ↓ banded growth; handles + tail adapt, edges auto-route), and **canvas virtualization** (`onlyRenderVisibleElements`). Green gate passed (vitest 448, typecheck, lint, build); manual QA accepted. *Deferred: left-right radial layout; slides + canonical-AST rebuild; autosave retry-with-backoff; auto-collapse beyond N nodes.*

**M12 shipped** on `feat/mindmap` — **many-to-many node ↔ doc links** (block **E**), settling the architecture: **the tree is the core/SSOT; markdown docs just attach to nodes, M:N** (no canonical-AST merge). A **Link…** picker attaches an existing bundle doc to another node; the doc bar surfaces an **🔗 also:** row of the other nodes sharing the open doc; a **Docs** panel lists every project doc with its referencing nodes. No format change (`DocRef[]` per node already allowed the same path on many nodes). Green gate passed (vitest 451, typecheck, lint, build).

**M13 shipped** on `feat/mindmap` — **all of backlog §E** (project format, persistence & resilience): **untitled New project** (save-as on first save), **orphaned-doc GC** (manual, via the Docs panel), **save-failure surfacing + retry** (backoff + a banner), **project notes** in the manifest, **schema history/versions** (snapshots on save, restore as a new tab — reuses the markdown editor's version store), **cross-`.inkproj` links** (a node links to other projects; `.inkproj`-only for safety), and **canvas image thumbnails** (a node `assets/…` image). Green gate passed (vitest 459, typecheck, lint, build).

**M14 shipped** on `feat/mindmap` — **the rest of backlog §D** (import / export / interop): **`.xmind` import** (real XMind ZIP — `content.json` / `content.xml`), **import into an open project** (merge an imported map under a node), **two-tier node text on import** (title + `data.note` subtitle), **interactive HTML export** (opt-in inline script folds branches in the browser), and a **`.mindnode` writer** (export — the inverse of the reader's protobuf walk; round-trips through Inkwell, MindNode-app compatibility unverified). Green gate passed (vitest 470, typecheck, lint, build).

**M15 shipped** on `feat/mindmap` — **the rest of backlog §B** (nodes & visuals): **line / embedded shapes**, **task subtree progress rollup** (a `done/total` badge on parents), **rich-text labels** (`data.fontSize`/`fontFamily` + inline-markdown segments `**b**`/`*i*`/`` `c` ``/`~~s~~`), **custom theme palettes** (a by-depth color editor), and **left+right radial layout** (the root's children split two-sided; per-node `side` drives handle/tail placement). Green gate passed (vitest 476, typecheck, lint, build).

**M16 shipped** on `feat/mindmap` — the small leftovers: a **slides projection** (a `Slides` view — a deck of section nodes, prev/next nav; the last multi-view) and **auto-collapse for large maps** (a `Fit` action + on-open seeding for maps > 400 nodes). Green gate passed (vitest 480, typecheck, lint, build).

**M17 shipped** on `feat/mindmap` (built on `feat/mindmap-elk`, merged `--no-ff`) — **ELK auto-layout** (`elkjs`): an **opt-in alternative engine** to the banded layout, picked per project via a **Banded / ELK** toolbar toggle. Async (computed off the render path) with the banded layout as a no-flicker fallback; only the visible tree feeds ELK (mrtree for right/down, radial otherwise); manual pins override the result via the shared `applyPins`. Green gate passed (vitest 486, typecheck, lint, build); live QA accepted. **This closes the backlog** — only §F (collaboration & AI) remains as a separate strategic track.
