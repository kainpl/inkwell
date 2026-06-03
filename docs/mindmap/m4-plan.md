# Milestone 4 — plan + design (export to standalone HTML)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Export the active project to a **single self-contained `.html`** — a read-only, shareable artifact (open in any browser, no Inkwell). Vision backlog ("MindDoc-style shareable read-only").

**Architecture.** A **pure generator** turns the engine-agnostic graph (`buildGraph`) into a **nested-outline HTML** (`<ul>`/`<li>` tree) with inline CSS — no SVG layout math, so it always renders cleanly. Each node shows its styling (fill/color/icons/tags), its outgoing **cross-links** (typed, colored), and its **docs** as collapsible sections (clicking a node jumps to its doc). The renderer collects internal doc contents, calls the generator, and hands the string to main to save via a dialog. Reuses `buildGraph` + the link-type registry; no new model. Decisions: [`our-vision.md`](our-vision.md) §5/§8 backlog.

**Conventions:** pure generator unit-tested; IPC via `shared/ipc.ts`; main-side save dialog; commit per green group; one QA.

---

## Phase M4.1 — HTML generator (pure)

**Files:** create `lib/mindmap/exportHtml.ts` (+ test).

- [x] **M4.1.1 Failing test** `exportHtml.test.ts` — `renderProjectHtml({ title, graph, linkTypes, docs })` returns a string that: starts with `<!DOCTYPE html>`, contains the title, every node label, a cross-link's type label, and a doc's content (escaped). HTML-escapes `<`/`>`/`&`; asserts no `<script`.
- [x] **M4.1.2 Implement** `renderProjectHtml(input)`:
  - `input`: `{ title: string; graph: GraphModel; linkTypes: Record<string,LinkType>; docs: Record<string, { label: string; items: { title: string; content: string }[] }> }` (docs keyed by nodeId).
  - Build `id→label` + `id→GraphNode`. Recurse roots via `graph.childrenOf`; each `<li>` = a styled node chip (fill/`color`/icons/tags from `data`), its outgoing cross-links (`graph.edges` `kind==='cross'`, `source===id` → `→ <typeLabel>: <targetLabel>` colored by `linkTypes`), a `<details>` per attached doc (`<pre>` escaped content, `id="doc-<nodeId>-<i>"`), then a nested `<ul>` of children. Node chip links to its first doc (`<a href="#doc-…">`) when present.
  - Inline `<style>` (light theme, system font, readable). Everything escaped via a local `esc()`.
- [x] **M4.1.3** run → pass. **M4.1.4** committed with M4 (`1a74b5c`).

## Phase M4.2 — collect docs + wire

**Files:** modify `index.ts` (`inkproj:exportHtml`); `shared/ipc.ts`, `preload`; `projectActions.ts` (`exportHtml`); `menu.ts`, `App.tsx`, `i18n/{en,uk,ru}.ts`.

- [x] **M4.2.1** Main `inkproj:exportHtml(html, suggestedName)`: save dialog (`.html`) → write → return path/null. `shared/ipc.ts` `inkprojExportHtml` + `menuExportHtmlProject`; `preload` method; `menuChannels`.
- [x] **M4.2.2** `projectActions.exportHtml()`: `buildGraph(yjsToOutline(doc))`; gather internal docs via `readDoc` (external skipped); `renderProjectHtml(...)` with `entry.linkTypes`; `inkproj.exportHtml(html, title + '.html')`.
- [x] **M4.2.3** `menu.ts` File → Export Project as HTML…; `i18n` `file.exportProjectHtml` (en/uk/ru); `App.tsx` wire.
- [x] **M4.2.4** `typecheck`/`lint`/`build` green (vitest 412). **M4.2.5** committed with M4 (`1a74b5c`).

## Phase M4.3 — gate + QA

- [x] **M4.3.1** `npx vitest run` green (412 pass; known `Editor.tab.test.tsx` jsdom error remains); `typecheck`/`lint`/`build` clean.
- [x] **M4.3.2** Manual QA: export `sample.inkproj` → open the `.html` in a browser. **Passed.**
- [x] **M4.3.3** Update `docs/mindmap/README.md` → M4 shipped.
- [x] **M4.3.4** Manual QA accepted; committed + pushed to origin.

## Self-review
- **Reuses the engine-agnostic core:** `buildGraph` + link-type registry; no SVG/layout (nested `<ul>` always renders). ✓
- **Self-contained:** inline CSS, no external assets/scripts; opens anywhere. ✓
- **Security:** generator is pure + escapes all text; only internal bundle docs are read (external skipped); save via a main-side dialog. ✓
- **Backlog (later):** rendered-markdown docs (vs `<pre>`), an SVG canvas view, embedding images/assets, collapse state.
