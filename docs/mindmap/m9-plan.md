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

- [x] **A1** `exportFormats.ts` pure: `toOpml`, `toPlainMarkdown`, `toFreeMind` (with `COLOR`/`BACKGROUND_COLOR`/`FOLDED`). XML/text-escaped; 5 round-trip tests through `importAny`.
- [x] **A2** Main `inkproj:exportText(text, suggestedName)` → save dialog (filter inferred from the name's extension) → write → return path. `shared/ipc.ts` + `preload`.
- [x] **A3** `projectActions.exportAs('opml'|'md'|'mm')` builds via the generators from `yjsToOutline`; `menu.ts` File → **Export Schema as** ▸ (OPML / Markdown / FreeMind); i18n en/uk/ru; `App.tsx` wired (+ `menuChannels`).
- [x] **A4** `typecheck`/`lint` clean. Commit `feat(mindmap): export OPML / Markdown / FreeMind`.

## Phase B — interactive tasks + more shapes

**Files:** modify `nodeStyleOps.ts`, `MindNode.tsx`, `NodeInspector.tsx`.

- [x] **B1** `nodeStyleOps.cycleTask(doc, id)` — none → open → done → cancelled → none (clears `task`/`taskStatus` at 'none', preserves other keys). Tested.
- [x] **B2** `MindNode`: clickable task checkbox → `toggleTask` (open `☐` / done `☑` / cancelled `⊘`, strikethrough label when closed). `NodeInspector`: a Task control cycling the status.
- [x] **B3** `cloud` (border-radius) + `hexagon`/`octagon` (clip-path, two stacked clipped layers for a visible outline) added to `SHAPE_*` + the inspector list. The tail control moved to a wrapper element so clip-path can't hide it.
- [x] **B4** `typecheck`/`lint` clean. Commit `feat(mindmap): interactive tasks + more node shapes`.

## Phase C — frames (group brackets)

**Files:** modify `nodeStyleOps.ts`/types, `Canvas.tsx` (+ a `Frames` overlay), `NodeInspector.tsx`.

- [x] **C1** `data.frame: 'bracket' | 'underline'` → `subtreeBounds(graph, collapsed, layout, id)` (collapse-aware bbox, tested) drives a translucent `Frames` overlay in a `ViewportPortal`, behind the nodes.
- [x] **C2** `NodeInspector`: a Frame select (none / bracket / underline) via `apply({ frame })`.
- [x] **C3** Exported HTML: frames left as backlog (no change to `renderProjectHtml`).
- [x] **C4** `typecheck`/`lint`/`build` green. Commit `feat(mindmap): subtree frames`.

## Phase D — gate + QA

- [x] **D1** `npx vitest run` green (438; +11 new across exportFormats/nodeStyleOps/layout); `typecheck`/`lint`/`build` clean.
- [ ] **D2** QA: export OPML/MD/.mm + re-import; toggle tasks; new shapes; frames around a subtree. Update `README.md` + `backlog.md`. Hand off; commit/push per OK. *(handed off)*

## Self-review
- **Additive (D1):** tasks/shape/frame are node `data`; export generators are read-only. ✓
- **Reuses:** ops, the generic export IPC, `ViewportPortal` overlay, the inspector. ✓
- **Deferred to M10:** mind-map themes (node palettes), PDF/PNG/Print, rich-text labels, layout-direction options.
