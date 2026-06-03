# Milestone 7 — plan (schema editor: navigation & interaction — backlog block A)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Make big maps (esp. imported ones) navigable and fast to edit — block **A** of [`backlog.md`](backlog.md): node search, keyboard navigation, multi-select + batch ops, tag-highlight, canvas focus mode.

**Architecture.** Pure tree helpers (`treeNav.ts`) over the engine-agnostic `GraphModel` (search, ancestors, navigate, expand-to-level) — unit-tested, no React. UI state (search box, multi-selection, highlighted tag, focus node) lives on the project entry in `useProjectStore`. Reveal/center uses React Flow's `useReactFlow().setCenter`, so the bits that center the viewport render **inside** `<ReactFlow>` (Canvas). Selection/dimming flows through `buildRfModel` (already the single node→RF transform). Decisions: [`backlog.md`](backlog.md) §A.

**Conventions:** pure helpers tested on a bare graph; commit per green group; one QA at the end.

---

## Phase A — node search + reveal

**Files:** create `lib/mindmap/treeNav.ts` (+ test), `components/Mindmap/SearchPanel.tsx`; modify `useProjectStore.ts` (search state), `Canvas.tsx` (render the panel inside RF), `ProjectView.tsx` (Ctrl+Shift+F toggle).

- [ ] **A1** `treeNav.ts` pure helpers + test: `searchNodes(graph, q) → string[]` (case-insensitive label substring, in tree order); `ancestorsOf(graph, id) → string[]` (root→parent chain).
- [ ] **A2** `useProjectStore` entry: `searchOpen: boolean`; actions `toggleSearch()`, `setSearchOpen(b)`.
- [ ] **A3** `SearchPanel` (rendered inside Canvas's `<ReactFlow>` as a `<Panel position="top-center">` when `searchOpen`): an input; live `searchNodes` over the live graph; `N/M` counter; Enter / ↓ / ↑ cycle matches; Esc closes. Revealing a match = `expand(ancestor)` for each ancestor + `select(id)` + `useReactFlow().setCenter(x+w/2, y+h/2, { zoom, duration:300 })` using the node's `layout` position.
- [ ] **A4** `ProjectView` key handler: `Ctrl/Cmd+Shift+F` → `toggleSearch()` (guard typing targets).
- [ ] **A5** `typecheck`/`lint`. Commit `feat(mindmap): node search + reveal`.

## Phase B — keyboard navigation

**Files:** modify `treeNav.ts` (+ test), `ProjectView.tsx`.

- [ ] **B1** `treeNav.navigate(graph, id, dir: 'up'|'down'|'left'|'right') → string|null`: up/down = prev/next visible sibling, left = parent, right = first child; honor a `collapsed` set (right on a collapsed node expands instead — return a sentinel or let the caller expand). `expandToLevel(graph, level) → Set<string>` (collapse every node deeper than `level`). Tests.
- [ ] **B2** `ProjectView` keys (when a node is selected, not editing/typing): arrows → `navigate` + `select` (+ center, reusing the reveal helper); `1–9` → `expandToLevel(n)` (replace the collapsed set); `0` → expand all (empty set). `Home` → select+center root.
- [ ] **B3** `typecheck`/`lint`. Commit `feat(mindmap): keyboard navigation + expand-to-level`.

## Phase C — multi-select + batch ops

**Files:** modify `useProjectStore.ts`, `rfModel.ts`, `MindNode.tsx`, `Canvas.tsx`, `NodeInspector.tsx`, `projectEditActions.ts`.

- [ ] **C1** `useProjectStore` entry: `multi: Set<string>` (extra selected nodes; `selectedId` stays the "primary"). Actions: `toggleInSelection(id)` (Shift/Cmd-click), `clearMulti()`. `select(id)` clears `multi`.
- [ ] **C2** `rfModel.buildRfModel`: a node renders selected when `id === selectedId || multi.has(id)` (pass the set). `Canvas` `onNodeClick`: if Shift/Meta held → `toggleInSelection(node.id)`; else normal select+openDoc.
- [ ] **C3** `projectEditActions` batch helpers over `selectedId ∪ multi`: `styleSelection(patch)`, `addTagToSelection(tag)`, `deleteSelection()`. `NodeInspector` / `EditToolbar` apply to the whole selection when `multi` is non-empty (Delete key too).
- [ ] **C4** `typecheck`/`lint`. Commit `feat(mindmap): multi-select + batch ops`.

## Phase D — tag-highlight + focus mode

**Files:** modify `useProjectStore.ts`, `rfModel.ts`/`MindNode.tsx`, `NodeInspector.tsx`, `ProjectView.tsx`, `treeNav.ts`.

- [ ] **D1** `useProjectStore` entry: `highlightTag: string|null`, `focusId: string|null` + actions `setHighlightTag`, `setFocus`. `treeNav.focusSet(graph, id) → Set` (the node + its ancestors + descendants).
- [ ] **D2** Dimming in `buildRfModel`: compute a `dimmed` flag per node — `highlightTag` set → dim nodes whose `data.tag` lacks it; `focusId` set → dim nodes outside `focusSet`. `MindNode` lowers opacity when `dimmed`.
- [ ] **D3** UI: clicking a tag chip (`NodeInspector` / a node's tag) toggles `highlightTag`; a Focus toggle (toolbar button + a key, e.g. `.`) sets/clears `focusId` to the selected node. Esc clears highlight/focus.
- [ ] **D4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): tag-highlight + canvas focus mode`.

## Phase E — polish (stretch)

- [ ] **E1** Hotkeys help overlay (`?`) listing the schema shortcuts.
- [ ] **E2** Quick Entry box (keyboard-first rapid add under the selected node).
- [ ] **E3** Breadcrumb of the selected node's path.

## Phase F — gate + QA

- [ ] **F1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **F2** QA on `sample.inkproj` + an imported `.mindnode`: search reveals + centers; arrows/expand-levels; multi-select + batch; tag-highlight; focus. Update `README.md` + `backlog.md` (mark A done). Hand off; commit/push per OK.

## Self-review
- **Pure where it counts:** search/ancestors/navigate/expand-to-level/focusSet are pure + tested; only viewport-center + dimming are UI. ✓
- **Reuses the single transform:** selection + dimming go through `buildRfModel`. ✓
- **Centering:** the viewport-centering pieces render inside `<ReactFlow>` (Canvas) so `useReactFlow` is in scope. ✓
- **Feeds the strategy:** these make the schema editor usable at scale before the schema⟷markdown Outline bridge (block C). ✓
