# Milestone 6 — plan + design (canvas polish: multi-root layout + drop-ghost)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes. **Status: plan for review.**

**Goal:** Two interaction/layout fixes for the schema canvas: lay out **multiple roots** without overlap, and show a **live drop indicator** ("ghost") while dragging so reparent/reorder is predictable.

**Architecture.** Both build on the engine-agnostic core. Multi-root is a pure change to `computeLayout` (stack each root's subtree below the previous). The ghost reuses the M2c drop heuristic from `onNodeDragStop` — factored into a shared pure helper `resolveDrop(...)` used by both `onNodeDrag` (preview) and `onNodeDragStop` (commit) — plus a transient overlay. Decisions: [`our-vision.md`](our-vision.md) §8 backlog (layout/magnetism polish); M2c §C3 (reorder).

**Conventions:** pure layout change unit-tested; the ghost is interaction (manual QA); commit per green group.

---

## Phase A — multi-root layout

**Design.** Today `computeLayout` lays out each root from the origin → roots overlap (an M1 limitation, now reachable: `addSibling` on a root makes a second root). Fix: lay out each root's subtree, measure its vertical extent, and **offset each subsequent root** by the running height + a gap, so root subtrees stack vertically and never overlap.

**Files:** modify `layout.ts` (+ `layout.test.ts`).

- [x] **A1 Failing test** `layout.test.ts` — two roots → subtree y-ranges disjoint; first root unchanged vs a solo layout.
- [x] **A2 Implement** `computeLayout`: per root collect cross-axis extent, shift each later root below the previous + `ROOT_GAP` (first root natural). Pins still win.
- [x] **A3** `typecheck`/`lint` green. Commit `feat(mindmap): non-overlapping multi-root layout` (`b4386a3`).

## Phase B — drop-ghost (live drag indicator)

**Design.** Extract the M2c drop logic into a pure `resolveDrop(graph, model, draggedId, dropPos) → { kind:'child', targetId } | { kind:'sibling', parentId, index, beforeId } | null`. `onNodeDragStop` calls it then `reparent`/`reorder` (same behavior, deduped). `onNodeDrag` calls it (throttled) to set a transient `dropHint`; an overlay renders: a **highlight ring** on the target for `child`, or a **horizontal line** at the sibling insertion slot. Cleared on drag stop.

**Files:** create `lib/mindmap/resolveDrop.ts` (+ test); modify `Canvas.tsx` (use it in both handlers + render the overlay), `MindNode.tsx` (optional drop-target ring class).

- [x] **B1 Failing test** `resolveDrop.test.ts` — child / sibling(index, before) / null. Pure (positions + graph).
- [x] **B2 Implement** `resolveDrop` (nearest node, `CHILD_DX`, before/after by Y). `Canvas.onNodeDragStop` uses it (behavior unchanged). run → pass.
- [x] **B3** `Canvas.onNodeDrag` (throttled by hint key) → `dropHint`; overlay via **ViewportPortal** (flow coords — cleaner than flow→screen): dashed ring for `child`, accent line at the sibling slot. Cleared on drop.
- [x] **B4** `typecheck`/`lint`/`build` green (vitest 422). Commit `feat(mindmap): drag drop-ghost indicator` (`1a8bfd2`).

## Phase C — gate + QA

- [x] **C1** `npx vitest run` green (422); `typecheck`/`lint`/`build` clean.
- [ ] **C2** QA both; update `README.md`; hand off; commit/push per OK. *(handed off)*

## Self-review / open points
- **Pure where it counts:** layout + `resolveDrop` are pure + unit-tested; only the overlay is interaction. ✓
- **No behavior change to reorder/reparent:** `resolveDrop` is the *same* logic factored out — `onNodeDragStop` keeps doing exactly what it did, now shared with the preview. ✓
- **Overlay coordinates:** flow→screen conversion is the one fiddly bit; if `flowToScreenPosition` proves awkward, fall back to rendering the indicator as a non-interactive React Flow node. (open)
- **Backlog:** magnetism/snap polish, multi-select drag, collapse-aware drop, animated transitions.
