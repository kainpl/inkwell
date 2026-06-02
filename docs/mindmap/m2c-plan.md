# Milestone 2c — plan + design (node styling · anchors · reorder · external docs)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Four backlog slices on `feat/mindmap`, built in order, each a green task-group; **one combined QA** at the end (per the user's request).

**Architecture:** All edits go through the per-tab **Yjs** model (`LOCAL_ORIGIN` → M2a undo). Styling/anchor/doc data lives in the node `data` bag (`dataJson`) or the doc text — additive (D1, interop-safe). Persistence reuses the M2b bundle Save (schema + manifest + docs). Spec context is inline per phase below. Decisions: [`our-vision.md`](our-vision.md) §6 (D3/D6/D7), backlog §8.

**Conventions:** transactions tagged `LOCAL_ORIGIN`; pure ops unit-tested on a bare `Y.Doc`; IPC via `shared/ipc.ts`; commit per green group; **no per-phase QA — one big QA at the end**.

---

# Phase C1 — node styling

**Design.** The `NodeData` bag already has `fillColor`, `color` (text), `lineColor`/`borderColor`, `shape`, `icon?: string[]`, `tag?: string[]` (M1 types). `MindNode` already paints fill/text/border. C1 adds a **Node Inspector** (floating panel, shares the bottom-left slot with the Edge Inspector — node vs link selection is mutually exclusive) to edit these, and finishes `MindNode` rendering (shape, icons, tags). All writes go through `setNodeData` (one Yjs op).

**Files:** create `nodeStyleOps.ts` (+ test), `NodeInspector.tsx`; modify `MindNode.tsx`, `ProjectView.tsx`, `projectEditActions.ts`.

- [ ] **C1.1 Failing test** `nodeStyleOps.test.ts` — `setNodeData(doc, 'a', { fillColor:'#abc', shape:'pill' })` merges into the node's data (other keys preserved); `addTag`/`removeTag`, `addIcon`/`removeIcon` mutate the arrays.
- [ ] **C1.2 Implement** `nodeStyleOps.ts`: `setNodeData(doc, id, patch: Partial<NodeData>)` (read-modify-write `dataJson`, `LOCAL_ORIGIN`); thin `addTag/removeTag/addIcon/removeIcon` helpers over it. run → pass.
- [ ] **C1.3** `projectEditActions`: `styleNode(patch)`, `toggleTag/addIcon/...` that resolve the active doc + `selectedId`, call the op, `markDirty`.
- [ ] **C1.4** `MindNode`: render `shape` (rounded/rectangle/pill/ellipse → border-radius class), `icon[]` (prefix spans), `tag[]` (small chips row). Keep fill/text/border (already there).
- [ ] **C1.5** `NodeInspector.tsx` — shown when `selectedId` (and not editing): fill / text / line color inputs, shape `<select>`, icon add (emoji input) + removable list, tag add (text) + removable chips. Each → `styleNode`/helpers + dirty.
- [ ] **C1.6** `ProjectView`: render `<NodeInspector/>` in the canvas column (next to `EdgeInspector`; only one shows at a time).
- [ ] **C1.7** `typecheck`/`lint`. **C1.8** commit `feat(mindmap): node styling (color/shape/icons/tags)`.

---

# Phase C2 — anchors UI (D6)

**Design.** Anchors are explicit ids: `{#id}` on a heading, `^id` on any block/line (M1 `resolveAnchor` already navigates them). C2 adds (a) **inserting** an anchor at the caret in the editable doc pane, and (b) pointing the open node's doc ref at an anchor. Anchor listing is a pure parse helper.

**Files:** modify `anchors.ts` (+ test) — add `listAnchors`; modify `DocPane.tsx` (expose the live view), `DocBar.tsx` (Anchor + Link-anchor actions); `docOps.ts` (`setDocAnchor`).

- [ ] **C2.1 Failing test** `anchors.test.ts` — `listAnchors('## H {#sec}\n\ntext ^b1\n')` → `[{id:'sec', line:0, kind:'heading'}, {id:'b1', line:2, kind:'block'}]`.
- [ ] **C2.2 Implement** `listAnchors(text)` in `anchors.ts` (scan lines for `{#id}` and trailing `^id`). run → pass.
- [ ] **C2.3** `DocPane`: keep the `EditorView` reachable (store the live view in a ref exposed via a small module-level registry keyed by tab, or lift an `insertAnchorAtCaret(view)` helper). Add `insertAnchorAtCaret`: if the caret line is a heading → append ` {#id}`; else append ` ^id` (id via `genId`-style short id). Buffers (dirty) via the existing updateListener.
- [ ] **C2.4** `DocBar`: **Anchor** button (caret-insert, enabled when a doc is open & internal) and **Link anchor ▾** (a menu of `listAnchors(currentText)` → `setDocAnchor(nodeId, docIndex, '#id')` so the node ref points there).
- [ ] **C2.5** `docOps.ts`: `setDocAnchor(doc, nodeId, index, anchor)` (patch `data.docs[index].anchor`, Yjs transact).
- [ ] **C2.6** `typecheck`/`lint`. **C2.7** commit `feat(mindmap): anchor insert + node→anchor linking`.

---

# Phase C3 — sibling reorder (drag)

**Design.** M2a drag drops a node *onto* another → becomes its child (order = end). C3 adds **reorder among siblings**. Layout is left→right (children right of parent, siblings stacked vertically), so on drop near a node `t` at a similar X (not in t's child zone), treat it as a sibling move relative to `t` (before if dropped above t, after if below). A new `reorder` op places the node and renumbers `order`.

**Files:** modify `treeOps.ts` (+ test) — add `reorder`; modify `Canvas.tsx` (drop heuristic).

- [ ] **C3.1 Failing test** `treeOps.test.ts` — `reorder(doc, 'c', parent, 0)` puts C first among its siblings; `reorder` to a later index works; orders normalize to `0..n`.
- [ ] **C3.2 Implement** `reorder(doc, nodeId, newParentId, index)`: set `parentId`, rebuild the sibling id list with `nodeId` inserted at `index`, reassign `order = 0..n` (cycle-guarded like `reparent`). run → pass.
- [ ] **C3.3** `Canvas onNodeDragStop`: find nearest node `t` within radius. If drop X clearly right of `t` (child zone, `dx > NODE_W*0.5`) → `reparent` (existing). Else → sibling move: `reorder(node, parentOf(t), indexOf(t in siblings) + (dropY < t.y ? 0 : 1))`. Snap back if no target.
- [ ] **C3.4** (light) a drop indicator line between siblings via `onNodeDrag` (optional; skip if fiddly — note it).
- [ ] **C3.5** `typecheck`/`lint`. **C3.6** commit `feat(mindmap): sibling reordering by drag`.

---

# Phase C4 — external docs (D7 completion)

**Design.** D7: external refs (`{external:true, src}`) are **read-blocked** in main (a stored `src` must never be auto-read). C4 completes the flow with **user-granted** reads only: **Attach external** (dialog → store ref + return content for this session), **Open external** (dialog re-grant → read), **Internalize** (dialog → copy into `docs/` → ref becomes internal). External content is cached transiently (never in `dirtyDocs`, never saved as a bundle doc).

**Files:** modify `zip.ts` (+ test) — `readExternalPicked`, `internalizePicked`; `index.ts` (dialogs); `shared/ipc.ts`, `preload`; `useProjectStore.ts` (`externalDocs` cache); `DocPane.tsx`, `DocBar.tsx`, `docOps.ts`.

- [ ] **C4.1** Main: `inkproj:attachExternal(workingDir)` → dialog; returns `{ ref:{external:true, src, title}, content }` (reads the just-picked file — a valid user grant). `inkproj:openExternal(workingDir)` → dialog; returns `{ src, content }`. `inkproj:internalize(workingDir)` → dialog; copies into `docs/` (reuse `attachDoc`'s copy); returns the internal `DocRef`. All path-validated; no stored-`src` reads. zip.test: internalize copies + returns an in-bundle path.
- [ ] **C4.2** `useProjectStore`: `externalDocs: Record<string,string>` (src→content, transient) + `setExternalDoc(src, content)`; cleared on tab close (it's per-entry).
- [ ] **C4.3** `docOps`/`projectEditActions`: `attachExternalToSelected` (push external ref + cache content + open), `internalizeOpenDoc` (replace the ref with the returned internal ref + dirty).
- [ ] **C4.4** `DocPane`: for an `external` ref, render the cached content (`externalDocs[src]`) read-only; if absent, show "external — Open to load".
- [ ] **C4.5** `DocBar`: **Attach external…**; when the open ref is external → **Open** (re-grant) + **Internalize**.
- [ ] **C4.6** `typecheck`/`lint`/`build`. **C4.7** commit `feat(mindmap): external docs (attach/open/internalize, D7)`.

---

# Phase C5 — combined gate + QA

- [ ] **C5.1** `npx vitest run` green (known `Editor.tab.test.tsx` jsdom error remains); `typecheck`/`lint`/`build` clean.
- [ ] **C5.2** One big manual QA on `sample.inkproj` across all four: styling round-trips; anchors insert + link + scroll; reorder; external attach/open/internalize; Save persists; file editing untouched.
- [ ] **C5.3** Update `docs/mindmap/README.md` → M2c shipped (per QA OK).
- [ ] **C5.4** Hand off for the one combined QA; commit/merge per the user's OK.

## Self-review
- **Additive / interop (D1):** styling + anchors live in `data`/doc text; external refs in `data.docs`; custom nothing-new in the ZIP → their reader still round-trips. ✓
- **Reuses M2a/M2b:** Yjs ops + undo, bundle Save, inspectors pattern, DocBar, attach copy-in. New = node inspector, anchor parse/insert, reorder op, external read-grant IPC. ✓
- **Security (D7):** external reads only via main-side dialogs (user grant); no stored-`src` auto-read; all writes path-validated in-bundle. ✓
- **One QA:** no per-phase QA gate; C5 is the single combined acceptance. ✓
