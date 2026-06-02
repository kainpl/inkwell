# Milestone 2a — spec (editing + save, Yjs model)

> The first editing slice: mutate a project's schema (create / rename / delete /
> reparent nodes), undo/redo, and save back to the `.inkproj`. The in-memory
> model becomes a **local Yjs doc** (D9) — free undo + a future collab path.
> Builds on M1 (read-only). Decisions: [`our-vision.md`](our-vision.md) §6.
> Status: spec for review.

## 1. Goal & scope

Turn the read-only project view into an editor for the **tree** (cross-link
drawing + doc attach are M2b), and persist edits.

**In scope (M2a):**
- **Yjs model** — one `Y.Doc` per open project tab; rendering + edits go through it.
- **Edit ops** — add child / add sibling, inline rename, delete (subtree), reparent by drag.
- **Undo / redo** — `Y.UndoManager`, `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z`.
- **Save** — serialize → `schema.mind-map` → re-zip the working dir → atomic write back to the source `.inkproj` (D12). `Cmd/Ctrl+S` while a project tab is active.
- **Dirty tracking** — edits mark the project tab dirty; the existing unsaved-guard (tab ×, window close) applies; save clears it.

**Out of scope (M2a → M2b/backlog):**
- Drawing cross-links, attaching docs, editing the doc pane (still read-only).
- Node styling UI (color/shape/icons/tags), frames, before/after sibling drop ordering with a phantom ghost (M2a reparent = drop-onto-a-node → becomes its child; ordering polish later).
- Networking / multiplayer (the Yjs doc runs **local**, no provider).
- Autosave of projects (explicit Save only in M2a; autosave later).

## 2. Yjs model

One `Y.Doc` per project tab, held in a main-thread **registry** (not in Zustand — Y.Doc is mutable/external): `Map<tabId, { doc: Y.Doc; undo: Y.UndoManager }>` in `lib/mindmap/yjsRegistry.ts`. Created on open, destroyed on tab close.

**Doc shape** (single-user; mirrors a trimmed source model):
```
doc.getMap('nodes'): Y.Map<nodeId, Y.Map {
  name: string,
  parentId: string | null,   // null = a root
  order: number,             // sibling order under parentId
  dataJson: string           // JSON of NodeData minus name (colors, links, docs, task, expand, pins…)
}>
doc.getMap('meta'): Y.Map { title: string }   // + room for viewport/theme later
```
- The **tree** is `parentId` + `order` (not nesting) — reparent/reorder are O(1) field writes, ideal for CRDT + undo.
- **Cross-links + doc refs stay in `dataJson`** (per D4/D3) — M2a carries them through untouched; M2b adds editing them.
- `Y.UndoManager(nodesMap, { trackedOrigins: new Set([LOCAL_ORIGIN]), captureTimeout: 400 })` — groups rapid edits (e.g. typing a rename) into one undo step.

**Why split `name` out of `dataJson`:** renames are the hottest edit; keeping `name` its own field means a rename writes a few bytes, not the whole bag (the source learned this the hard way — its v1 single-blob design blew the relay heap).

## 3. Conversions (reuse M1)

- **Yjs → outline** (`yjsToOutline`): group nodes by `parentId`, sort by `order`, build `MarkdownNode[]` (`{ name, children, data }`, data = `JSON.parse(dataJson)`). The single root becomes the outline root (implicit-root contract preserved).
- **outline → render**: feed `yjsToOutline` into the existing **`buildGraph`** → **`buildRfModel`** (M1, unchanged). So all M1 rendering is reused; only the *source* of the outline changes (Yjs instead of the static parsed schema).
- **outline → markdown** (save): the existing **`outlineToMarkdown`** (already ported, M1) → `schema.mind-map` text.
- **Seed on open**: `outlineToYjs(outline)` writes the parsed `.inkproj` schema into a fresh doc once.

A `useProjectGraph(tabId)` hook subscribes to the doc (`nodes.observeDeep`) and returns the current `GraphModel` (rebuilt via yjsToOutline+buildGraph on change; memoized; O(n) per edit — fine at M2a scale, optimize later). Canvas/DocPane consume it instead of the static `entry.graph`.

## 4. Edit operations (`lib/mindmap/treeOps.ts`)

All mutations run inside `doc.transact(fn, LOCAL_ORIGIN)` so undo groups them. Pure-ish helpers over the nodes Y.Map:

| Op | Effect |
| --- | --- |
| `addChild(doc, parentId)` | new node, `parentId=parent`, `order=maxChildOrder+1`, empty name → enters rename. |
| `addSibling(doc, nodeId)` | new node under the same parent, `order` after `nodeId`. |
| `rename(doc, nodeId, name)` | set `name`. |
| `remove(doc, nodeId)` | delete the node + all descendants; strip any `data.links` pointing at removed ids (in the same transaction). |
| `reparent(doc, nodeId, newParentId)` | set `parentId`; `order=maxChildOrder+1`; reject if `newParentId` is the node or a descendant (cycle guard). |

`maxChildOrder` / descendant checks derive from the current `parentId`/`order` fields. Each op is unit-tested against a bare `Y.Doc` (no React).

## 5. Undo / redo

`Y.UndoManager` per doc. `Cmd/Ctrl+Z` → `undo()`, `Cmd/Ctrl+Shift+Z` (and `Cmd/Ctrl+Y`) → `redo()`. Wired only while a project tab is active (so it doesn't fight the CodeMirror undo of file tabs). Inline-rename keystrokes coalesce via `captureTimeout`.

## 6. Save

**Track the source path.** `OpenedInkproj` gains `srcPath: string`; `openInkproj` returns it; the project tab/registry stores it (so we know where to write back).

**New IPC `inkproj:save`** (main): `(workingDir, schemaText, srcPath) →` write `schemaText` to `<workingDir>/schema.mind-map`, then zip the working dir → temp file → atomic rename over `srcPath`. Guarded: `workingDir` must be a known dir (reuse the `KNOWN_WORKING_DIRS` set from the security fix); `srcPath` must be the one this project was opened from (store it in the known-dirs map, not just a Set).

**Save flow (renderer)**: `saveProject(tabId)` → `outlineToMarkdown(yjsToOutline(doc))` → `window.api.inkproj.save(workingDir, schemaText, srcPath)` → on success mark the tab clean.

**Trigger**: `Cmd/Ctrl+S` (menuSave) — when the active tab is a project, route to `saveProject` instead of the file `saveDoc`. (Branch in the App menuSave handler on the active tab kind.) Also surface a Save affordance in the project edit toolbar.

**Dirty lifecycle**: any edit transaction sets the active project tab `dirty=true` (via `useAppStore` — add `setTabDirty(tabId, boolean)`); `saveProject` sets it false. The existing `closeTabById` guard + window-close guard already key off `tab.dirty`, so the unsaved prompt now fires for project tabs too. Project tabs stay **path-less** (M1) so file autosave/draft/disk-watch still skip them; project save is its own path.

## 7. UI

- **Edit toolbar** in the project view header (small, replaces M1's empty header space): Add child, Add sibling, Delete, Undo, Redo, Save (enabled per selection / dirty). Keyboard equivalents below.
- **Inline rename**: double-click a node → `contentEditable` (like the source) → Enter commits (`rename`), Esc cancels. New nodes auto-enter rename.
- **Keyboard** (project tab focused): `Tab` = add child to selected, `Enter` (on selected, not editing) = add sibling, `F2`/double-click = rename, `Delete`/`Backspace` = delete, `Cmd/Ctrl+Z`/`Shift+Z` = undo/redo, `Cmd/Ctrl+S` = save.
- **Reparent**: enable `nodesDraggable` for project tabs; `onNodeDragStop` → find the nearest node under the drop point (within a radius) → `reparent(dragged, target)`; if dropped on empty space, snap back (no change in M2a). A simple drop-target highlight; full magnetism/ordering is later.

## 8. Store / model changes

- `useAppStore`: add `openProjectTab` already exists; add `setTabDirty(id, dirty)`.
- `useProjectStore` entry: replace the static `graph` with `{ srcPath }` + keep `collapsed/selectedId/openDoc`; the live graph comes from `useProjectGraph(tabId)` (Yjs-derived). `setProjectForTab` seeds the Yjs doc (via the registry) from the opened schema.
- `yjsRegistry.ts`: create/get/destroy a doc+undo per tabId; `projectActions.cleanupProjectTab` destroys the doc too.

## 9. Acceptance (M2a “done”)

1. Open `sample.inkproj` → add a child to a node (Tab), rename it (type + Enter) — appears in the tree.
2. Delete a subtree; reparent a node by dragging it onto another → tree updates.
3. `Cmd/Ctrl+Z` undoes the last edit; redo re-applies; rename coalesces into one undo step.
4. The tab shows a dirty dot after edits; `Cmd/Ctrl+S` saves → re-open the file (or unzip) shows the new `schema.mind-map`; dirty clears.
5. Closing a dirty project tab (×) / closing the window prompts the unsaved guard.
6. File editing untouched; `typecheck/lint/build` green; new pure helpers (treeOps, yjsToOutline, outlineToYjs) unit-tested; full suite green.

## 10. Open points for review

- **Reparent fidelity in M2a** — simple drop-onto-node→child (recommend) vs. invest early in before/after ordering + ghost.
- **Doc pane** — stays read-only in M2a (recommend); editing docs into the bundle is M2b.
- **Save = overwrite source** vs. also keep a backup — recommend straight atomic overwrite (zip is cheap; M2b/crash-recovery handles safety).
- **Dep**: add `yjs` (UndoManager is in core; no provider/relay in M2a).

---

*Next after sign-off:* task-by-task M2a plan (writing-plans), build on `feat/mindmap`.
