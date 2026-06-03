# Milestone 16 — plan (slides projection + auto-collapse — the small leftovers)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Finish the small open items: the **slides projection** (§C — the last
multi-view) and **auto-collapse for large maps** (§G perf). **ELK auto-layout** (§G) is
**out of scope** — it's an L item needing a new heavy dependency (`elkjs`) + an async
alternative engine; flagged for a separate decision, not folded into this small sprint.

**Architecture.** Slides = a pure `buildSlides(graph)` (each node-with-children → a
title + its direct children as bullets), rendered by a new `SlidesPanel` `viewMode`
(like table). Auto-collapse = a pure `autoCollapse(graph, maxVisible)` (the deepest
expand-level that fits), wired to a toolbar **Fit** button + applied on open for very
large maps. Decisions: backlog §C/§G.

**Conventions:** pure helpers tested; reuse `visibleInOrder`/`expandToLevel`/the store; commit per green group.

---

## Phase A — slides projection

**Files:** create `lib/mindmap/buildSlides.ts` (+ test), `components/Mindmap/SlidesPanel.tsx`; modify `useProjectStore.ts` (`viewMode` += `'slides'`), `EditToolbar.tsx`, `ProjectView.tsx`.

- [ ] **A1** `buildSlides(graph)` → `{ id, title, bullets[] }[]` — one slide per node with children (title = its label, bullets = direct children labels), in tree order; a flat map falls back to one slide of all nodes. Pure; test.
- [ ] **A2** `viewMode` union gains `'slides'`; `EditToolbar` adds a **Slides** segment.
- [ ] **A3** `SlidesPanel`: shows the current slide (big title + bullet list), ◀ / ▶ nav + an `n / total` counter, ←/→ keys; clicking the title selects + centers the node.
- [ ] **A4** `ProjectView` renders `SlidesPanel` when `viewMode === 'slides'`.
- [ ] **A5** `typecheck`/`lint`. Commit `feat(mindmap): slides projection`.

## Phase B — auto-collapse for large maps

**Files:** create `lib/mindmap/autoCollapse.ts` (+ test); modify `projectEditActions.ts` (a `fitMap` action), `projectActions.ts` (apply on open when large), `EditToolbar.tsx` (a Fit button).

- [ ] **B1** `autoCollapse(graph, maxVisible)` → the collapsed `Set` for the **deepest** `expandToLevel` whose `visibleInOrder` count ≤ `maxVisible` (≥ level 1). Pure; test (a big tree collapses; a small tree stays empty).
- [ ] **B2** `projectEditActions.fitMap(maxVisible = 150)` — `setCollapsed(autoCollapse(graph, maxVisible))`. `EditToolbar`: a **⤢ Fit** button.
- [ ] **B3** `projectActions.enterProject`: when the opened map has no collapse data and `> 400` nodes, seed `collapsed = autoCollapse(graph, 200)` (keeps a huge map navigable on open).
- [ ] **B4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): auto-collapse large maps`.

## Phase C — gate + ship

- [ ] **C1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **C2** Update `README.md` + `backlog.md` (§C slides ✅; §G auto-collapse ✅, ELK noted as the lone deferred item). Commit; **push** (user pre-authorized the small leftovers).

## Self-review
- **Additive:** slides is a read-only projection; auto-collapse only sets collapse state. ✓
- **Reuses:** `visibleInOrder`, `expandToLevel`, the store collapse set, the inspector/toolbar. ✓
- **Honest scope:** **ELK auto-layout is NOT done** — it needs `elkjs` (~1 MB) + an async alternative layout engine; surfaced as a separate decision rather than silently pulled into a "small" milestone.
