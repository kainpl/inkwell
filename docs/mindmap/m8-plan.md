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

- [x] **A1** `treeNav.visibleInOrder` (tested).
- [x] **A2** `useProjectStore` `viewMode` + `setViewMode`.
- [x] **A3** `OutlinePanel`: indented rows, collapse caret, selected highlight, doc/tag chips; row focus selects + centers the map. (Rows inline, no separate `OutlineRow`.)
- [x] **A4** `EditToolbar` Map/Outline/Split toggle; `ProjectView` renders the left column by mode (split = outline | map).
- [x] **A5** Commit `feat(mindmap): outline view (read + select + collapse)` (`d7c9004`).

## Phase B — outline editing

**Files:** modify `OutlineRow.tsx`, `treeOps.ts` (indent/outdent helpers if needed), `projectEditActions.ts`.

- [x] **B1** Each row is a controlled input → `renameNode` live; Esc blurs; structural edits restore focus via a ref.
- [x] **B2** Keys: Enter = add sibling + focus; Tab / Shift+Tab = indent / outdent; Backspace (empty) = delete + focus prev; ↑/↓ = move focus. Reuses `treeOps` + `treeNav.navigate`.
- [x] **B3** Edits mark dirty; map + outline update live from the shared model.
- [x] **B4** `typecheck`/`lint`/`build` green (vitest 431). Commit `feat(mindmap): outline editing (rename / indent / reorder)` (`287706a`).

## Phase C — gate + QA

- [x] **C1** `npx vitest run` green (431); `typecheck`/`lint`/`build` clean.
- [ ] **C2** QA: toggle Map/Outline/Split; edit in the outline → map updates; Tab/Shift+Tab; Enter/Backspace; sync. *(handed off)*

## Self-review
- **One model, two views:** outline + map both read `useProjectGraph` and write through `treeOps`/`rename` — no serialization round-trip, identity/undo/cross-links preserved. ✓
- **Reuses everything:** `treeOps`, `treeNav`, store selection/collapse, `centerOnNode`. ✓
- **Strategy:** first real schema⟷markdown bridge; sets up later multi-view (AST projections). ✓
- **Stretch (later):** drag-reorder rows; show/edit a node's doc inline from the outline; outline-only columns (notes).
