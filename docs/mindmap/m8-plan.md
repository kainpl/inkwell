# Milestone 8 — plan (Outline view — schema ⟷ markdown bridge, backlog block C)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Edit the schema as an **indented, editable outline**, switchable with the
mind-map (Map / Outline / Split), both driven by the **same Yjs model**. The headline
bridge toward uniting schemas + markdown (the schema *is* a markdown outline).

**Architecture.** An `OutlinePanel` renders the visible tree as rows (depth-indented,
with a collapse caret + an editable label) from `useProjectGraph`, exactly like the
canvas. Structural edits reuse `treeOps` (`reparent`/`reorder`/`addSibling`/`remove`)
+ `rename`; selection/collapse are the same store state — so map and outline stay in
lockstep and undo/cross-links/docs are preserved (no text re-serialization). View mode
is a per-project store flag. Decisions: [`backlog.md`](backlog.md) §C; [`our-vision.md`](our-vision.md) (md-first).

**Conventions:** pure `visibleInOrder` tested; reuse `treeOps`/`treeNav`; commit per green group.

---

## Phase A — view toggle + read-only outline

**Files:** create `lib/mindmap/treeNav.ts` `visibleInOrder` (+ test), `components/Mindmap/OutlinePanel.tsx` + `OutlineRow.tsx`; modify `useProjectStore.ts` (`viewMode`), `ProjectView.tsx` (render by mode), `EditToolbar.tsx` (Map/Outline/Split toggle).

- [ ] **A1** `treeNav.visibleInOrder(graph, collapsed) → { id, depth }[]` — DFS over roots, skipping children of collapsed nodes. Test.
- [ ] **A2** `useProjectStore` entry `viewMode: 'map' | 'outline' | 'split'` (default `'map'`) + `setViewMode`.
- [ ] **A3** `OutlinePanel` (scrollable): rows via `visibleInOrder`; each `OutlineRow` = depth indent + collapse caret (`toggleCollapse`) + label. The selected row is highlighted; clicking a row `select`s it (+ `centerOnNode` so the map follows). Doc/📄 + tag chips shown compactly.
- [ ] **A4** `EditToolbar`: a Map / Outline / Split segmented toggle (`setViewMode`). `ProjectView` left column renders Canvas / OutlinePanel / both (split = outline | map side-by-side).
- [ ] **A5** `typecheck`/`lint`. Commit `feat(mindmap): outline view (read + select + collapse)`.

## Phase B — outline editing

**Files:** modify `OutlineRow.tsx`, `treeOps.ts` (indent/outdent helpers if needed), `projectEditActions.ts`.

- [ ] **B1** Inline rename: each row's label is an editable input; Enter/blur commits `rename`; Esc reverts. New rows auto-focus.
- [ ] **B2** Keyboard in a row (outliner semantics): **Enter** = add sibling after + focus it; **Tab** = indent (reparent under the previous sibling); **Shift+Tab** = outdent (reparent as a sibling of the parent, just after it); **Backspace** on an empty label = delete + focus previous; **↑/↓** = move focus to the previous/next visible row. Reuse `treeOps.reparent`/`reorder` + `treeNav.navigate`.
- [ ] **B3** Editing marks the tab dirty; map + outline update live from the shared model.
- [ ] **B4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): outline editing (rename / indent / reorder)`.

## Phase C — gate + QA

- [ ] **C1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **C2** QA: toggle Map/Outline/Split; edit a node in the outline → the map updates and vice-versa; Tab/Shift+Tab restructure; Enter/Backspace; selection + collapse stay in sync. Update `README.md` + `backlog.md`. Hand off; commit/push per OK.

## Self-review
- **One model, two views:** outline + map both read `useProjectGraph` and write through `treeOps`/`rename` — no serialization round-trip, identity/undo/cross-links preserved. ✓
- **Reuses everything:** `treeOps`, `treeNav`, store selection/collapse, `centerOnNode`. ✓
- **Strategy:** first real schema⟷markdown bridge; sets up later multi-view (AST projections). ✓
- **Stretch (later):** drag-reorder rows; show/edit a node's doc inline from the outline; outline-only columns (notes).
