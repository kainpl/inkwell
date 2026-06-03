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

- [ ] **A1** `saveGuard.isCatastrophicShrink(prev, next)`: `prev >= 10 && next < prev*0.5 && prev-next >= 10`. Test (normal deletes pass; a wipe is flagged; tiny docs exempt).
- [ ] **A2** `useProjectStore`: `savedNodeCount` (init 0) + `setSavedNodeCount(n)`. `saveProject` sets it to `nodesOf(doc).size` on success.
- [ ] **A3** `projectAutoSave.startProjectAutoSave(delay, save)`: subscribe to `useAppStore`; when `autoSave` && the active tab is a dirty project, debounce → if `isCatastrophicShrink(savedNodeCount, currentCount)` skip + `log`, else `saveProject(tabId)`. `App.tsx` starts it (like `startAutoSave`).
- [ ] **A4** `typecheck`/`lint`. Commit `feat(mindmap): project autosave + shrink-guard`.

## Phase B — table view (AST projection)

**Files:** create `components/Mindmap/TablePanel.tsx`; modify `useProjectStore.ts` (`viewMode` += `'table'`), `EditToolbar.tsx` (Table segment), `ProjectView.tsx` (render by mode).

- [ ] **B1** `viewMode` union gains `'table'`; `EditToolbar` adds a **Table** segment.
- [ ] **B2** `TablePanel`: a flat table over `visibleInOrder(graph, collapsed)` — columns: depth-indented **label** (input → `renameNode`), **Task** (button → `toggleTask`), **Tags**, **Note** (truncated). Row click selects + `centerOnNode`. Reuses the outline's edit ops.
- [ ] **B3** `ProjectView`: render the left column explicitly per mode (map / outline / table / split = outline|map). 
- [ ] **B4** `typecheck`/`lint`. Commit `feat(mindmap): table view (AST projection)`.

## Phase C — layout direction (right / down)

**Files:** modify `lib/mindmap/layout.ts` (+ test), `useProjectStore.ts` (`direction` + `setDirection`), `Canvas.tsx` (pass direction), `MindNode.tsx` (handles + tail by direction), `EditToolbar.tsx` (direction toggle).

- [ ] **C1** `computeLayout(graph, collapsed, direction='right')`: depth on the X axis (`right`) or Y axis (`down`); axis-specific `RANK`/`NODE`/`ROOT` separations (`down`: wider cross pitch ≈ node width, shorter rank pitch). Default `right` ⇒ existing tests unchanged. Test: `down` siblings share Y, differ X.
- [ ] **C2** `useProjectStore`: `direction: 'right' | 'down'` (init `right`) + `setDirection`. `Canvas` reads it and passes it to `computeLayout`.
- [ ] **C3** `MindNode`: read `direction`; `right` → target=Left/source=Right + tail on the right edge; `down` → target=Top/source=Bottom + tail on the bottom edge. (Edges auto-route from handle positions.)
- [ ] **C4** `EditToolbar`: a direction toggle (→ horizontal / ↓ vertical).
- [ ] **C5** `typecheck`/`lint`/`build`. Commit `feat(mindmap): layout direction (horizontal / vertical)`.

## Phase D — canvas virtualization

**Files:** modify `Canvas.tsx`.

- [ ] **D1** Add `onlyRenderVisibleElements` to `<ReactFlow>` (only in-viewport nodes mount); a brief code note on the collapse + render-visible perf story.
- [ ] **D2** `typecheck`/`lint`/`build`. Commit `perf(mindmap): only render visible canvas elements`.

## Phase E — gate + QA

- [ ] **E1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **E2** QA: autosave (toggle on, edit, watch it save; delete most nodes → autosave skips, explicit Save still works); Table view edits + selects; direction → / ↓ relayouts with correct handles/edges; large map stays smooth. Update `README.md` + `backlog.md`. Hand off; commit/push per OK.

## Self-review
- **Additive:** direction + viewMode are store flags; autosave reuses the global toggle; the shrink-guard only blocks *auto*-saves (explicit Save always proceeds). ✓
- **Reuses:** `startAutoSave` pattern, `visibleInOrder`, `renameNode`/`toggleTask`, `centerOnNode`, the banded layout. ✓
- **Deferred (note):** left-right **radial** layout (both-sides branch assignment + mirrored bands) and the full **AST multi-view** rebuild (table is the first concrete projection; slides/canonical-AST remain) — both want their own milestone + QA iteration.
