# Milestone 2c — plan + design (node styling · anchors · reorder · external docs)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Four backlog slices on `feat/mindmap`, built in order, each a green task-group; **one combined QA** at the end (per the user's request).

**Architecture:** All edits go through the per-tab **Yjs** model (`LOCAL_ORIGIN` → M2a undo). Styling/anchor/doc data lives in the node `data` bag (`dataJson`) or the doc text — additive (D1, interop-safe). Persistence reuses the M2b bundle Save (schema + manifest + docs). Spec context is inline per phase below. Decisions: [`our-vision.md`](our-vision.md) §6 (D3/D6/D7), backlog §8.

**Conventions:** transactions tagged `LOCAL_ORIGIN`; pure ops unit-tested on a bare `Y.Doc`; IPC via `shared/ipc.ts`; commit per green group; **no per-phase QA — one big QA at the end**.

---

# Phase C1 — node styling

**Design.** The `NodeData` bag already has `fillColor`, `color` (text), `lineColor`/`borderColor`, `shape`, `icon?: string[]`, `tag?: string[]` (M1 types). `MindNode` already paints fill/text/border. C1 adds a **Node Inspector** (floating panel, shares the bottom-left slot with the Edge Inspector — node vs link selection is mutually exclusive) to edit these, and finishes `MindNode` rendering (shape, icons, tags). All writes go through `setNodeData` (one Yjs op).

**Files:** create `nodeStyleOps.ts` (+ test), `NodeInspector.tsx`; modify `MindNode.tsx`, `ProjectView.tsx`, `projectEditActions.ts`.

- [x] **C1.1 Failing test** `nodeStyleOps.test.ts` — `setNodeData(doc, 'a', { fillColor:'#abc', shape:'pill' })` merges into the node's data (other keys preserved); `addTag`/`removeTag`, `addIcon`/`removeIcon` mutate the arrays.
- [x] **C1.2 Implement** `nodeStyleOps.ts`: `setNodeData(doc, id, patch: Partial<NodeData>)` (read-modify-write `dataJson`, `LOCAL_ORIGIN`); thin `addTag/removeTag/addIcon/removeIcon` helpers over it. run → pass.
- [x] **C1.3** ~~`projectEditActions` wrappers~~ — folded: `NodeInspector` calls the ops directly via `getProjectDoc` + `setTabDirty` (same pattern as `EdgeInspector`).
- [x] **C1.4** `MindNode`: renders `shape` (rounded/rectangle/pill/ellipse → border-radius class), `icon[]` (prefix spans), `tag[]` (chips row). Keeps fill/text/border.
- [x] **C1.5** `NodeInspector.tsx` — shown when `selectedId` (and not editing): fill / text / line color inputs, shape `<select>`, icon add + removable list, tag add + removable chips. Each → op + dirty.
- [x] **C1.6** `ProjectView`: renders `<NodeInspector/>` in the canvas column (next to `EdgeInspector`; only one shows at a time).
- [x] **C1.7** `typecheck`/`lint` green (vitest 406). **C1.8** commit `feat(mindmap): node styling (color/shape/icons/tags)` (`fd3b956`).

---

# Phase C2 — anchors UI (D6)

**Design.** Anchors are explicit ids: `{#id}` on a heading, `^id` on any block/line (M1 `resolveAnchor` already navigates them). C2 adds (a) **inserting** an anchor at the caret in the editable doc pane, and (b) pointing the open node's doc ref at an anchor. Anchor listing is a pure parse helper.

**Files:** modify `anchors.ts` (+ test) — add `listAnchors`; modify `DocPane.tsx` (expose the live view), `DocBar.tsx` (Anchor + Link-anchor actions); `docOps.ts` (`setDocAnchor`).

- [x] **C2.1 Failing test** `anchors.test.ts` — `listAnchors('## H {#sec}\n\ntext ^b1\n')` → `[{id:'sec', line:0, kind:'heading'}, {id:'b1', line:2, kind:'block'}]`.
- [x] **C2.2 Implement** `listAnchors(text)` in `anchors.ts` (scans for heading `{#id}` and trailing `^id`). run → pass.
- [x] **C2.3** `docView.ts` registry holds the live `EditorView`; `insertAnchorAtCaret` appends ` {#id}` on a heading line, else ` ^id`; buffered via the update listener. `DocPane` registers/clears the view.
- [x] **C2.4** `DocBar`: ⚓ insert-anchor button + a Link-anchor `<select>` (lists `listAnchors(view text)` → `linkOpenDocAnchor('#id')`, re-opens to scroll), shown for an open internal doc.
- [x] **C2.5** `docOps.ts`: `setDocAnchor(doc, nodeId, index, anchor?)` (patch `data.docs[index].anchor`, Yjs transact; empty clears).
- [x] **C2.6** `typecheck`/`lint` green (vitest 408). **C2.7** commit `feat(mindmap): anchor insert + node→anchor linking` (`69226c1`).

---

# Phase C3 — sibling reorder (drag)

**Design.** M2a drag drops a node *onto* another → becomes its child (order = end). C3 adds **reorder among siblings**. Layout is left→right (children right of parent, siblings stacked vertically), so on drop near a node `t` at a similar X (not in t's child zone), treat it as a sibling move relative to `t` (before if dropped above t, after if below). A new `reorder` op places the node and renumbers `order`.

**Files:** modify `treeOps.ts` (+ test) — add `reorder`; modify `Canvas.tsx` (drop heuristic).

- [x] **C3.1 Failing test** `treeOps.test.ts` — `reorder(doc, 'c', parent, 0)` puts C first among its siblings; `reorder` to a later index works; orders normalize to `0..n`.
- [x] **C3.2 Implement** `reorder(doc, nodeId, newParentId, index)`: set `parentId`, rebuild the sibling id list with `nodeId` inserted at `index`, reassign `order = 0..n` (cycle-guarded). run → pass.
- [x] **C3.3** `Canvas onNodeDragStop`: nearest node `t` within radius; drop X right of `t` (`dx > CHILD_DX=100`, half the 200px level gap) → `reparent`; else sibling `reorder` (before/after by drop Y). Snap back if no target/rejected.
- [~] **C3.4** drop-indicator line — **skipped** (optional polish; reorder works on drop without a live ghost).
- [x] **C3.5** `typecheck`/`lint` green (vitest 409). **C3.6** commit `feat(mindmap): sibling reordering by drag` (`92eaade`).

---

# Phase C4 — external docs (D7 completion)

**Design.** D7: external refs (`{external:true, src}`) are **read-blocked** in main (a stored `src` must never be auto-read). C4 completes the flow with **user-granted** reads only: **Attach external** (dialog → store ref + return content for this session), **Open external** (dialog re-grant → read), **Internalize** (dialog → copy into `docs/` → ref becomes internal). External content is cached transiently (never in `dirtyDocs`, never saved as a bundle doc).

**Files:** modify `zip.ts` (+ test) — `readExternalPicked`, `internalizePicked`; `index.ts` (dialogs); `shared/ipc.ts`, `preload`; `useProjectStore.ts` (`externalDocs` cache); `DocPane.tsx`, `DocBar.tsx`, `docOps.ts`.

- [x] **C4.1** Main: `inkproj:pickExternal` → dialog; returns `{ src, content, title }` (reads ONLY the just-picked file — serves both attach-external and re-open). `inkproj:internalize(workingDir)` → dialog; copies into `docs/` via `attachDoc`; returns the internal `DocRef`. No stored-`src` reads. zip.test covers the `attachDoc` copy-in.
- [x] **C4.2** `useProjectStore`: `externalDocs: Record<string,string>` (src→content, transient) + `setExternalDoc`; lives on the entry → gone on tab close.
- [x] **C4.3** `docOps.replaceDocRef`; `projectEditActions` `attachExternalToSelected` / `openExternalDoc` (re-grant) / `internalizeOpenDoc` (swap ref + dirty).
- [x] **C4.4** `DocPane`: external ref → cached content (`externalDocs[src]`) read-only; absent → "external — use Open to load".
- [x] **C4.5** `DocBar`: **Ext…** (attach external); when the open ref is external → **Open** (re-grant) + **Internalize**.
- [x] **C4.6** `typecheck`/`lint`/`build` green (vitest 410). **C4.7** commit `feat(mindmap): external docs (attach/open/internalize, D7)` (`5a571cb`).

---

# Phase C5 — combined gate + QA

- [x] **C5.1** `npx vitest run` green (410 pass; known `Editor.tab.test.tsx` jsdom error remains); `typecheck`/`lint`/`build` clean.
- [x] **C5.2** One big manual QA on `sample.inkproj` across all four. **Passed.**
- [x] **C5.3** Update `docs/mindmap/README.md` → M2c shipped.
- [x] **C5.4** Manual QA accepted; committed + pushed to origin.

## Self-review
- **Additive / interop (D1):** styling + anchors live in `data`/doc text; external refs in `data.docs`; custom nothing-new in the ZIP → their reader still round-trips. ✓
- **Reuses M2a/M2b:** Yjs ops + undo, bundle Save, inspectors pattern, DocBar, attach copy-in. New = node inspector, anchor parse/insert, reorder op, external read-grant IPC. ✓
- **Security (D7):** external reads only via main-side dialogs (user grant); no stored-`src` auto-read; all writes path-validated in-bundle. ✓
- **One QA:** no per-phase QA gate; C5 is the single combined acceptance. ✓
