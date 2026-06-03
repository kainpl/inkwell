# Milestone 9 — plan (schema visuals + exports — backlog blocks B & D)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Push the schema editor's visuals + interop further: more **export formats**
(OPML / Markdown / FreeMind `.mm`), **interactive tasks**, more **node shapes**, and
**frames** (group brackets). Backlog blocks **B** (visuals) + **D** (export).

**Architecture.** Pure text generators (`exportFormats.ts`) `outline → OPML/MD/.mm`,
unit-tested, written via a generic main `inkproj:exportText` save dialog. Tasks/shapes
are node `data` (additive, D1) toggled through the existing ops; frames render as an SVG
overlay (`ViewportPortal`) like the drop-ghost. Decisions: [`backlog.md`](backlog.md) §B/§D.

**Conventions:** pure generators tested; reuse ops/IPC; commit per green group; one QA.

---

## Phase A — export OPML / Markdown / FreeMind

**Files:** create `lib/mindmap/exportFormats.ts` (+ test); modify `main/inkproj/{zip? index}.ts` (`inkproj:exportText`), `shared/ipc.ts`, `preload`, `projectActions.ts`, `menu.ts`, `i18n`, `App.tsx`.

- [ ] **A1** `exportFormats.ts` pure: `toOpml(title, outline)`, `toPlainMarkdown(outline)` (nested bullets, no data comments), `toFreeMind(title, outline)` (`<map><node TEXT=…>` with `COLOR`/`BACKGROUND_COLOR` from `data`). All XML/text-escaped. Tests (round-trippable shapes).
- [ ] **A2** Main `inkproj:exportText(text, suggestedName)` → save dialog (filter from the name's extension) → write → return path. `shared/ipc.ts` + `preload`.
- [ ] **A3** `projectActions`: `exportAs(kind: 'opml'|'md'|'mm')` builds the text from `outlineToMarkdown`-source outline (`yjsToOutline`) via the generator → `inkproj.exportText`. `menu.ts` File → Export ▸ (OPML / Markdown / FreeMind); `i18n`; `App.tsx` wire.
- [ ] **A4** `typecheck`/`lint`. Commit `feat(mindmap): export OPML / Markdown / FreeMind`.

## Phase B — interactive tasks + more shapes

**Files:** modify `nodeStyleOps.ts`, `MindNode.tsx`, `NodeInspector.tsx`.

- [ ] **B1** `nodeStyleOps.cycleTask(doc, id)` — none → open → done → cancelled → none (sets `task`/`taskStatus`). Test.
- [ ] **B2** `MindNode`: the task checkbox is clickable → `cycleTask`; render open `☐` / done `☑` (strikethrough label) / cancelled `⊘`. `NodeInspector`: a Task control (toggle + status).
- [ ] **B3** More shapes in `SHAPE_RADIUS` + the inspector list: add `cloud`/`hexagon`/`octagon` (approximate with border-radius / clip-path), keep rounded/rectangle/pill/ellipse.
- [ ] **B4** `typecheck`/`lint`. Commit `feat(mindmap): interactive tasks + more node shapes`.

## Phase C — frames (group brackets)

**Files:** modify `nodeStyleOps.ts`/types, `Canvas.tsx` (+ a `Frames` overlay), `NodeInspector.tsx`.

- [ ] **C1** `data.frame: 'bracket' | 'underline' | null` on a node → draws a frame around that node's **visible subtree** bounding box. Compute the bbox from `layout` + visible descendants; render an SVG rect/bracket in a `ViewportPortal` (like the drop-ghost).
- [ ] **C2** `NodeInspector`: a Frame control (none / bracket / underline). `setNodeData({ frame })`.
- [ ] **C3** Exported HTML: frames noted as backlog (skip in `renderProjectHtml` for now).
- [ ] **C4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): subtree frames`.

## Phase D — gate + QA

- [ ] **D1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **D2** QA: export OPML/MD/.mm + re-import; toggle tasks; new shapes; frames around a subtree. Update `README.md` + `backlog.md`. Hand off; commit/push per OK.

## Self-review
- **Additive (D1):** tasks/shape/frame are node `data`; export generators are read-only. ✓
- **Reuses:** ops, the generic export IPC, `ViewportPortal` overlay, the inspector. ✓
- **Deferred to M10:** mind-map themes (node palettes), PDF/PNG/Print, rich-text labels, layout-direction options.
