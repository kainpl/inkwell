# Milestone 7 — plan (schema editor: navigation & interaction — backlog block A)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Make big maps (esp. imported ones) navigable and fast to edit — block **A** of [`backlog.md`](backlog.md): node search, keyboard navigation, multi-select + batch ops, tag-highlight, canvas focus mode.

**Architecture.** Pure tree helpers (`treeNav.ts`) over the engine-agnostic `GraphModel` (search, ancestors, navigate, expand-to-level) — unit-tested, no React. UI state (search box, multi-selection, highlighted tag, focus node) lives on the project entry in `useProjectStore`. Reveal/center uses React Flow's `useReactFlow().setCenter`, so the bits that center the viewport render **inside** `<ReactFlow>` (Canvas). Selection/dimming flows through `buildRfModel` (already the single node→RF transform). Decisions: [`backlog.md`](backlog.md) §A.

**Conventions:** pure helpers tested on a bare graph; commit per green group; one QA at the end.

---

## Phase A — node search + reveal

**Files:** create `lib/mindmap/treeNav.ts` (+ test), `components/Mindmap/SearchPanel.tsx`; modify `useProjectStore.ts` (search state), `Canvas.tsx` (render the panel inside RF), `ProjectView.tsx` (Ctrl+Shift+F toggle).

- [x] **A1** `treeNav.searchNodes` + `ancestorsOf` (tested).
- [x] **A2** `useProjectStore` `searchOpen` + `toggleSearch`/`setSearchOpen`.
- [x] **A3** `SearchPanel` (RF `<Panel>`): filter, N/M, Enter/↑/↓ cycle, Esc; reveal = expand ancestors + select + center (`centerOnNode`).
- [x] **A4** `Ctrl/Cmd+Shift+F` toggles search.
- [x] **A5** Commit `feat(mindmap): node search + reveal` (`40b02f8`).

## Phase B — keyboard navigation

**Files:** modify `treeNav.ts` (+ test), `ProjectView.tsx`.

- [x] **B1** `treeNav.navigate` + `expandToLevel` (tested). Right on a collapsed node is handled by the caller (expands instead of moving).
- [x] **B2** `ProjectView` keys: arrows navigate + center; `1–9` expand-to-level; `0` expand all; `Home` → root. `canvasViewport.centerOnNode` bridges centering out of the flow.
- [x] **B3** Commit `feat(mindmap): keyboard navigation + expand-to-level` (`5bcf36d`).

## Phase C — multi-select + batch ops

**Files:** modify `useProjectStore.ts`, `rfModel.ts`, `MindNode.tsx`, `Canvas.tsx`, `NodeInspector.tsx`, `projectEditActions.ts`.

- [x] **C1** `useProjectStore` `multi:Set` + `toggleInSelection` (first pick = primary); `select`/`openDocFor` clear it.
- [x] **C2** `buildRfModel` selected = `selectedId ∪ multi`; `Canvas onNodeClick` modifier-click toggles.
- [x] **C3** `projectEditActions` `styleSelection` / `addTagToSelection` / `deleteSelection` (one undo step); `NodeInspector` colors/shape/tag + `EditToolbar`/`ProjectView` Delete apply to the selection.
- [x] **C4** Commit `feat(mindmap): multi-select + batch ops` (`1d35623`).

## Phase D — tag-highlight + focus mode

**Files:** modify `useProjectStore.ts`, `rfModel.ts`/`MindNode.tsx`, `NodeInspector.tsx`, `ProjectView.tsx`, `treeNav.ts`.

- [x] **D1** `useProjectStore` `highlightTag` + `focusId` (+ `setHighlightTag`/`setFocus`); `treeNav.focusSet` (tested).
- [x] **D2** `buildRfModel` `dimmed` flag (no-tag under highlight / outside focus set); `MindNode` opacity.
- [x] **D3** Node tag chips toggle highlight (active = accent); `EditToolbar` Focus button + `.` key; Esc clears highlight + focus.
- [x] **D4** `typecheck`/`lint`/`build` green (vitest 430). Commit `feat(mindmap): tag-highlight + canvas focus mode` (`ad0b7e3`).

## Phase E — polish (stretch)

- [ ] **E1** Hotkeys help overlay (`?`) listing the schema shortcuts.
- [ ] **E2** Quick Entry box (keyboard-first rapid add under the selected node).
- [ ] **E3** Breadcrumb of the selected node's path.

## Phase F — gate + QA

- [x] **F1** `npx vitest run` green (430); `typecheck`/`lint`/`build` clean. (Phases A–D; E is stretch.)
- [ ] **F2** QA on `sample.inkproj` + an imported `.mindnode`. *(handed off)*

## Self-review
- **Pure where it counts:** search/ancestors/navigate/expand-to-level/focusSet are pure + tested; only viewport-center + dimming are UI. ✓
- **Reuses the single transform:** selection + dimming go through `buildRfModel`. ✓
- **Centering:** the viewport-centering pieces render inside `<ReactFlow>` (Canvas) so `useReactFlow` is in scope. ✓
- **Feeds the strategy:** these make the schema editor usable at scale before the schema⟷markdown Outline bridge (block C). ✓
