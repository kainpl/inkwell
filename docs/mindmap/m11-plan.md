# Milestone 11 — plan (layout direction · AST projection · autosave · virtualization)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Drain the two M11-headline items in concrete, shippable form — **layout
direction** (right / down) and an **AST → table projection** (a third view of the one
model) — plus the near-term resilience/perf backlog: **project autosave + shrink-guard**
(block E) and **canvas virtualization** (block G).

**Architecture.** Direction + the table view are additive: `computeLayout` gains a
direction param (depth on the X or Y axis, axis-specific separations); `MindNode`
positions its handles + tail control by direction; a new `TablePanel` is a fourth
`viewMode` over the same `visibleInOrder` rows. Autosave mirrors the markdown editor's
`startAutoSave` (debounced, gated on the global `autoSave` flag) with a pure
**shrink-guard** that refuses to *auto*-persist a catastrophic node-count drop.
Decisions: [`backlog.md`](backlog.md) §B/§C/§E/§G.

**Conventions:** pure ops/guards tested; reuse the autosave pattern, `visibleInOrder`,
the store; commit per green group; one QA.

---

## Phase A — project autosave + shrink-guard

**Files:** create `lib/mindmap/saveGuard.ts` (+ test), `lib/mindmap/projectAutoSave.ts`; modify `useProjectStore.ts` (`savedNodeCount` + `setSavedNodeCount`), `projectActions.ts` (update count on save), `App.tsx` (start it).

- [x] **A1** `saveGuard.isCatastrophicShrink(prev, next)` (`prev≥10 && next<prev*0.5 && prev−next≥10`). 5 tests.
- [x] **A2** `useProjectStore.savedNodeCount` (init 0) + `setSavedNodeCount`; `saveProject` sets it to `nodesOf(doc).size`.
- [x] **A3** `startProjectAutoSave` (active dirty project, debounced, shrink-guard skip + warn); started in `App.tsx`.
- [x] **A4** `typecheck`/`lint` clean. Commit `feat(mindmap): project autosave + shrink-guard`.

## Phase B — table view (AST projection)

**Files:** create `components/Mindmap/TablePanel.tsx`; modify `useProjectStore.ts` (`viewMode` += `'table'`), `EditToolbar.tsx` (Table segment), `ProjectView.tsx` (render by mode).

- [x] **B1** `viewMode` += `'table'`; `EditToolbar` Table segment.
- [x] **B2** `TablePanel`: flat rows over `visibleInOrder` — indented label input (`renameNode`), Task (`toggleTask`), Tags, Note; row click selects + `centerOnNode`.
- [x] **B3** `ProjectView` renders the left column explicitly per mode (map / outline / table / split).
- [x] **B4** `typecheck`/`lint` clean. Commit `feat(mindmap): table view (AST projection)`.

## Phase C — layout direction (right / down)

**Files:** modify `lib/mindmap/layout.ts` (+ test), `useProjectStore.ts` (`direction` + `setDirection`), `Canvas.tsx` (pass direction), `MindNode.tsx` (handles + tail by direction), `EditToolbar.tsx` (direction toggle).

- [x] **C1** `computeLayout(graph, collapsed, direction='right')`: depth on X (`right`) or Y (`down`); axis-specific `SEP` (`down`: cross pitch ≈ node width, shorter rank). Default `right` ⇒ existing tests unchanged. Test: `down` siblings share Y, differ X.
- [x] **C2** `useProjectStore.direction` (init `right`) + `setDirection`; `Canvas` passes it to `computeLayout`.
- [x] **C3** `MindNode` reads direction → handles + tail on Left/Right (`right`) or Top/Bottom (`down`); edges auto-route.
- [x] **C4** `EditToolbar`: a → / ↓ direction toggle.
- [x] **C5** `typecheck`/`lint`/`build` green. Commit `feat(mindmap): layout direction (horizontal / vertical)`.

## Phase D — canvas virtualization

**Files:** modify `Canvas.tsx`.

- [x] **D1** `onlyRenderVisibleElements` on `<ReactFlow>` (only in-viewport nodes mount).
- [x] **D2** `typecheck`/`lint`/`build` green. Commit `perf(mindmap): only render visible canvas elements`.

## Phase E — gate + QA

- [x] **E1** `npx vitest run` green (448; +6 across saveGuard / layout); `typecheck`/`lint`/`build` clean.
- [x] **E2** QA: autosave (toggle on, edit, watch it save; delete most nodes → autosave skips, explicit Save still works); Table view edits + selects; direction → / ↓ relayouts with correct handles/edges; large map stays smooth. *(accepted; pushed)*

## Self-review
- **Additive:** direction + viewMode are store flags; autosave reuses the global toggle; the shrink-guard only blocks *auto*-saves (explicit Save always proceeds). ✓
- **Reuses:** `startAutoSave` pattern, `visibleInOrder`, `renameNode`/`toggleTask`, `centerOnNode`, the banded layout. ✓
- **Deferred (note):** left-right **radial** layout (both-sides branch assignment + mirrored bands) and the full **AST multi-view** rebuild (table is the first concrete projection; slides/canonical-AST remain) — both want their own milestone + QA iteration.
