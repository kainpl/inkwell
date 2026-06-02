# Milestone 2b — spec (cross-link & doc editing)

> The second editing slice. M2a made the **tree** editable + saveable; M2b makes
> the two things that hang off nodes editable: **typed cross-links** (draw / retype /
> relabel / delete, incl. custom types) and **attached documents** (attach / create /
> detach + an **editable** doc pane that saves into the bundle).
> Builds on M1 (render) + M2a (Yjs model, save). Decisions: [`our-vision.md`](our-vision.md) §6.
> Status: spec for review.

## 1. Goal & scope

M2b has **two independent phases** — each ships and QAs on its own:

- **Phase A — cross-links.** Draw a typed edge from any node to any node, change its
  type/label, delete it; manage first-class **custom link types**. Storage is the
  source node's `data.links` (D4); the live edges already render (M1) — A adds *editing*.
- **Phase B — docs.** Attach an existing `.md` (copy-in), create a new doc from a node,
  detach; **edit** the doc in the right pane and **save** it back into the `.inkproj`.

**In scope (M2b):**
- Cross-link create/update/delete via React Flow's native connect + an **Edge Inspector**.
- Custom link types (label/color/arrow), persisted in `manifest.json`.
- Editable doc pane (replaces M1's read-only view), buffered per-doc, flushed on project Save.
- Attach (user file-picker copy-in, D7 default), create-new, detach doc refs (`data.docs`, D3).
- One unified atomic Save that writes schema + manifest + edited docs, then re-zips (D12).

**Out of scope (M2b → M2c/backlog):**
- **External** doc references + the internalize flow (D7 security; still read-blocked — backlog).
- Anchor-**creation** UI (`{#id}` / `^id`) — M2b keeps anchor **navigation** (M1) and lets a
  ref carry a manually-typed anchor; inserting block-ids is later.
- Orphaned-doc garbage collection (detach leaves the file in the bundle; GC later).
- Sibling **reordering** with a ghost, node **styling** (color/shape/icon/tag), frames, multiselect.
- Networking (the Yjs doc stays local).

## 2. Phase A — cross-link editing

### 2.1 Model & ops (`lib/mindmap/crossLinkOps.ts`)
Cross-links are `data.links: CrossLink[]` on the **source** node (`{ id, to, type, label?, file? }`,
D4) — carried in `dataJson`. New helpers over the nodes `Y.Map`, each wrapped in
`doc.transact(fn, LOCAL_ORIGIN)` (so they join the M2a undo history):

| Op | Effect |
| --- | --- |
| `addCrossLink(doc, fromId, toId, type='relates-to', label?) → linkId` | push `{ id: genId(), to: toId, type, label }` onto the from-node's `links`. Reject `fromId===toId`. |
| `updateCrossLink(doc, fromId, linkId, patch: {type?, label?})` | merge into the matching link. |
| `removeCrossLink(doc, fromId, linkId)` | drop the link from `links`. |

Read-modify-write the from-node's `dataJson` (`JSON.parse` → mutate `links` → `JSON.stringify`).
Unit-tested on a bare `Y.Doc` (no React), like `treeOps`. `remove(node)` already strips inbound
links to deleted nodes (M2a) — unchanged.

### 2.2 Graph plumbing (so an edge maps back to its owner)
A drawn edge must resolve to `{ fromNodeId, linkId }` to edit it. Today a cross `GraphEdge`
carries `{ id, source, target, kind:'cross', type, label }`. Add the link id:
- **`GraphEdge.linkId?: string`** (set for cross edges from the `CrossLink.id`); `buildGraph` fills it.
- **`RfEdgeData`** gains `{ fromNodeId: string; linkId: string }` (alongside `linkType`); `buildRfModel`
  copies `source`→`fromNodeId` and `linkId` for cross edges.
Tree edges are untouched (no `linkId`). `buildGraph`/`rfModel` unit tests extend to assert `linkId`.

### 2.3 Draw UX
- Project tabs set **`nodesConnectable`** on (Canvas only mounts for projects). `MindNode`'s
  Left (target) + Right (source) `Handle`s become connectable and fade in on node hover
  (they're `opacity:0` today). Tree layout is unaffected (tree edges are model-generated).
- **`onConnect({source, target})`** → `addCrossLink(doc, source, target)` (default `relates-to`)
  → mark dirty → select the new edge → open the Edge Inspector. A self-connect (source===target)
  is ignored by the op.

### 2.4 Edge selection + Edge Inspector
- Store `selectedLink: { fromNodeId: string; linkId: string } | null` on the project entry
  (mutually exclusive with node `selectedId` — selecting one clears the other).
- **`onEdgeClick`**: if `edge.type==='crosslink'`, set `selectedLink` from its `RfEdgeData`.
- **`EdgeInspector.tsx`** (small panel, bottom-left of the canvas, shown when `selectedLink`):
  - **Type** dropdown — every key in the project's link-type registry (built-ins + customs),
    rendered with its color swatch + label; change → `updateCrossLink(type)` + dirty.
  - **Label** text input → `updateCrossLink(label)` + dirty (coalesced by the undo captureTimeout).
  - **Delete** → `removeCrossLink` + dirty + clear `selectedLink`.
  - **+ New type…** → opens the custom-type mini-form (§2.5).
  - Selected cross edge is emphasized (thicker / halo) via a `selected` flag in `RfEdgeData`.
- `Delete`/`Backspace` with a `selectedLink` (and no node selected) also removes the link
  (extend the ProjectView key handler).

### 2.5 Custom link types (D5)
- The live registry is `entry.linkTypes` (merged built-ins + manifest overrides, M1). M2b lets
  the user add/edit a **custom type**: `{ key, label, color, arrow }`.
- Store the project's **manifest link-type overrides/customs** on the entry
  (`manifestLinkTypes: Record<string, LinkType>` — the non-built-in or overridden subset, i.e.
  what persists to `manifest.json`). Adding a type updates both `manifestLinkTypes` and the merged
  `linkTypes`, and marks the tab dirty.
- A custom type's `key` is a slug of its label (deduped). Built-ins can be **overridden** (e.g.
  recolor `blocks`) — that override also lands in `manifestLinkTypes`.
- Persisted via the manifest on Save (§4). No new file; `manifest.linkTypes` already exists (M1 reads it).

## 3. Phase B — doc editing

### 3.1 Editable doc pane + per-doc buffer
- `DocPane` drops `readOnly`/`editable.of(false)` and gains a minimal editing stack
  (`history()`, `keymap.of([...defaultKeymap, ...historyKeymap])`, `markdown()`, `lineWrapping`,
  `lineNumbers()`), plus an `updateListener` that, on doc change, writes the text into a
  **buffer** and marks the project tab dirty.
- **Buffer:** `entry.dirtyDocs: Record<string, string>` — bundle-relative doc path → edited text,
  for docs changed since the last save. DocPane's content source becomes
  `dirtyDocs[path] ?? await window.api.inkproj.readDoc(workingDir, ref)` so switching nodes and
  coming back shows the in-progress edit, not the on-disk version.
- Anchor scroll (M1) is unchanged; editing keeps the caret/history per the CM instance.
- **External** refs stay read-only (D7) — if `ref.external`, the pane shows the M1 read-only view
  with a "external — read only" note (no editing, no buffering).

### 3.2 Doc ops (`lib/mindmap/docOps.ts`, over `data.docs`)
`data.docs: DocRef[]` on a node (D3). Helpers (Yjs transact, dirty):

| Op | Effect |
| --- | --- |
| `attachDocDialog(doc, nodeId)` | open the OS file-picker via IPC → copy the chosen `.md` into `docs/` → push `{ path, title }` to the node's `docs`. (D7: main reads the user-picked file only; never a manifest path.) |
| `createDoc(doc, nodeId, title?)` | mint `path = docs/<nodeId>.md` (collision-free by node id; deduped if reused), seed `dirtyDocs[path] = '# <title>\n'`, push `{ path, title }`, open it. The file is materialized on Save (no IPC). |
| `detachDoc(doc, nodeId, index)` | remove the ref from the node's `docs`. The bundled file is left in place (GC later). |

`attachDocDialog` is the only one needing main: it returns the new in-bundle `DocRef` (or null if
cancelled). Create/detach are pure renderer + buffer.

### 3.3 DocBar (right-pane header)
A thin strip above the editor when a node is selected:
- The selected node's docs: a selector (when >1) showing titles/paths; picking one opens it.
- **New** (createDoc) and **Attach…** (attachDocDialog) for the selected node.
- **Detach** the current doc.
- A dirty dot on the open doc when it's in `dirtyDocs`.

When the selected node has no docs, the bar shows just **New** / **Attach…** and the editor area
shows the M1 empty hint.

## 4. Persistence — one atomic Save

Evolve the M2a save into a **bundle save** that writes everything dirty, then re-zips once.

- **IPC `inkproj:save`** payload becomes an object:
  `save(workingDir, payload: { schema: string; manifest?: InkprojManifest; docs?: { path: string; content: string }[] }, srcPath)`.
  Main (`saveInkproj`): assert `workingDir`/`srcPath` (M2a guard); write `schema` to the schema
  path; if `manifest` given, write `manifest.json`; for each `docs[]`, `safeJoin(workingDir, path)`
  (path-validated, in-bundle only) and write content; then walk + zip + atomic temp-rename (M2a).
- **`saveProject(tabId)`** (renderer) builds the payload: `schema = outlineToMarkdown(yjsToOutline(doc), title)`;
  `manifest` = the opened manifest with `linkTypes = manifestLinkTypes` (only if changed); `docs` =
  every `[path, content]` in `dirtyDocs`. On success: clear `dirtyDocs`, clear the dirty manifest
  flag, `setTabDirty(false)`.
- Save triggers unchanged (Cmd/Ctrl+S, toolbar) — they already route through `saveCurrent` (M2a).

## 5. Store / model changes

- `useProjectStore` entry gains: `selectedLink`, `manifestLinkTypes`, `manifestDirty: boolean`,
  `dirtyDocs: Record<string,string>`. Actions: `selectLink(fromNodeId, linkId)` (clears node
  selection), `setDocBuffer(path, content)`, `clearDirtyDocs()`, `addLinkType(type)`,
  `clearManifestDirty()`. `select(nodeId)` clears `selectedLink`.
- `crossLinkOps.ts`, `docOps.ts` — the edit helpers (mark dirty via `setTabDirty`, like M2a's
  `projectEditActions`; in fact extend `projectEditActions` to host the dirty-marking wrappers).
- `GraphEdge.linkId`, `RfEdgeData.{fromNodeId,linkId,selected}` — graph plumbing.
- `OpenedInkproj` already carries `manifest`; `enterProject` seeds `manifestLinkTypes` from
  `manifest.linkTypes ?? {}`.
- `shared/ipc.ts` + preload: `inkproj:save` payload shape; new `inkproj:attachDoc` (dialog+copy).

## 6. Security (reaffirm D7)
- **No new arbitrary-read surface.** Editing only ever touches **in-bundle** paths
  (`safeJoin`/`safeResolve` under a known `workingDir`). `dirtyDocs` keys are bundle-relative and
  re-validated in main on write.
- **Attach** reads the user-picked absolute path **once, in main, from a dialog result** — never a
  renderer- or manifest-supplied path; the file is copied in and only its in-bundle path is returned.
- **External** refs remain read-blocked (no editing/saving); manifest write stays in-bundle.

## 7. Acceptance (M2b "done")

**Phase A:**
1. Drag from one node's handle to another → a `relates-to` edge appears; the Edge Inspector opens.
2. Change its type (e.g. `depends-on`) → edge recolors + arrow updates; add a label → it shows.
3. Create a custom type (label+color) → it's selectable and applied; Save → reopen → the custom
   type and the edge persist (manifest + `data.links` round-trip through the `.inkproj`).
4. Select an edge → Delete removes it; undo/redo cover link create/retype/delete.

**Phase B:**
5. Select a node → **New** doc → type into the editor → the doc + node both show dirty.
6. **Attach…** a `.md` from disk → it's copied into `docs/` and linked; opening shows its content.
7. `Cmd/Ctrl+S` → reopen the project (or unzip) → the new/edited docs and the manifest are saved;
   the schema still round-trips; dirty clears.
8. **Detach** removes the ref (file remains). External refs stay read-only.
9. File editing untouched; `typecheck/lint/build` green; new pure helpers (crossLinkOps, docOps,
   graph `linkId`) unit-tested; full suite green.

## 8. Open points for review
- **Edge Inspector placement** — floating bottom-left panel (recommend) vs. a right-pane inspector
  that shares space with the doc editor.
- **Custom-type form** — inline mini-form in the inspector (recommend) vs. a separate modal.
- **createDoc path scheme** — `docs/<nodeId>.md` (collision-free, recommend) vs. a slug of the title
  (prettier in the zip, needs dedupe).
- **Phase split** — ship/QA **A then B** (recommend) vs. one combined drop.
- **Save payload** — evolve `inkproj:save` to the `{schema,manifest,docs}` object (recommend) vs.
  add separate `writeDoc`/`writeManifest` IPCs.

---

*Next after sign-off:* task-by-task M2b plan (writing-plans), build on `feat/mindmap`, Phase A first.
