# Milestone 2b — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Edit a project's **cross-links** (Phase A) and **attached docs** (Phase B), and save both back into the `.inkproj`. Reuses the M2a Yjs model + save.

**Architecture:** Cross-links live in the source node's `data.links`; docs in `data.docs` (both inside `dataJson`). New pure ops (`crossLinkOps`, `docOps`) mutate the per-tab `Y.Doc` under `LOCAL_ORIGIN` (so M2a undo covers them). Rendering reuses `buildGraph`/`buildRfModel` (M1) with a small `linkId` addition. Save evolves to a single bundle write (schema + manifest + edited docs → re-zip). Spec: [`m2b-spec.md`](m2b-spec.md).

**Conventions:** transactions tagged `LOCAL_ORIGIN`; pure helpers unit-tested on a bare `Y.Doc`; IPC via `shared/ipc.ts`; commit per green task-group during the build sprint, but during hands-on QA commit only on the user's OK.

---

## File structure

```
src/renderer/src/lib/mindmap/
  crossLinkOps.ts       add/update/remove cross-links over data.links     (Phase A)
  crossLinkOps.test.ts
  docOps.ts             attach/create/detach docs over data.docs           (Phase B)
  buildGraph.ts         (modify) emit GraphEdge.linkId for cross edges
  rfModel.ts            (modify) RfEdgeData { fromNodeId, linkId, selected }
  projectEditActions.ts (modify) dirty-marking wrappers for link/doc ops + saveProject payload
src/renderer/src/store/
  useProjectStore.ts    (modify) selectedLink, manifestLinkTypes, manifestDirty, dirtyDocs + actions
src/renderer/src/components/Mindmap/
  Canvas.tsx            (modify) nodesConnectable, onConnect, onEdgeClick, selected-edge styling
  MindNode.tsx          (modify) connectable handles (fade in on hover)
  EdgeInspector.tsx     type/label/delete + custom-type mini-form           (Phase A)
  DocPane.tsx           (modify) editable CM + dirtyDocs buffer             (Phase B)
  DocBar.tsx            new/attach/detach + doc selector                    (Phase B)
  ProjectView.tsx       (modify) render EdgeInspector + DocBar; Delete handles a selected link
src/main/inkproj/
  zip.ts                (modify) saveInkproj payload {schema,manifest,docs}; attachDoc (dialog+copy)
  index.ts              (modify) inkproj:save payload; inkproj:attachDoc handler
src/shared/ipc.ts, src/preload/index.ts   inkproj:save payload; inkproj:attachDoc
src/shared/mindmap/types.ts               GraphEdge.linkId
```

---

# Phase A — cross-link editing

## Task A1 — cross-link ops

**Files:** create `crossLinkOps.ts`, `crossLinkOps.test.ts`.

- [ ] **A1.1 Failing test** — on a bare `Y.Doc` seeded via `outlineToYjs`:
  - `addCrossLink(doc, a, b)` → a-node `data.links` has one `{ to:b, type:'relates-to' }` with an id; `yjsToOutline` reflects it.
  - `addCrossLink(doc, a, a)` → returns null / no-op (self-link rejected).
  - `updateCrossLink(doc, a, linkId, { type:'blocks', label:'x' })` → link updated.
  - `removeCrossLink(doc, a, linkId)` → link gone.
- [ ] **A1.2 Implement** `crossLinkOps.ts` — read-modify-write the from-node's `dataJson` inside `doc.transact(fn, LOCAL_ORIGIN)`:
```ts
import * as Y from 'yjs'
import type { CrossLink, NodeData } from '@shared/mindmap/types'
import { LOCAL_ORIGIN, genId, nodesOf } from './yjsModel'

const readData = (m: Y.Map<unknown>): NodeData =>
  JSON.parse((m.get('dataJson') as string) || '{}') as NodeData
const writeData = (m: Y.Map<unknown>, d: NodeData): void => m.set('dataJson', JSON.stringify(d))

export function addCrossLink(doc: Y.Doc, fromId: string, toId: string, type = 'relates-to', label?: string): string | null {
  if (fromId === toId) return null
  const m = nodesOf(doc).get(fromId)
  if (!m) return null
  const id = genId()
  doc.transact(() => {
    const d = readData(m)
    const links: CrossLink[] = Array.isArray(d.links) ? d.links : []
    writeData(m, { ...d, links: [...links, { id, to: toId, type, label }] })
  }, LOCAL_ORIGIN)
  return id
}
export function updateCrossLink(doc: Y.Doc, fromId: string, linkId: string, patch: Partial<Pick<CrossLink, 'type' | 'label'>>): void {
  const m = nodesOf(doc).get(fromId)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    const links = (d.links ?? []).map((l) => (l.id === linkId ? { ...l, ...patch } : l))
    writeData(m, { ...d, links })
  }, LOCAL_ORIGIN)
}
export function removeCrossLink(doc: Y.Doc, fromId: string, linkId: string): void {
  const m = nodesOf(doc).get(fromId)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    writeData(m, { ...d, links: (d.links ?? []).filter((l) => l.id !== linkId) })
  }, LOCAL_ORIGIN)
}
```
- [ ] **A1.3** run → pass. **A1.4** commit `feat(mindmap): cross-link edit ops`.

## Task A2 — graph plumbing for editable edges

**Files:** modify `shared/mindmap/types.ts`, `buildGraph.ts`, `rfModel.ts`; extend their tests.

- [ ] **A2.1** `GraphEdge` gains `linkId?: string`. In `buildGraph`, when emitting a cross edge from `node.data.links`, set `linkId: link.id` (and keep `source`=owning node id).
- [ ] **A2.2** `RfEdgeData` gains `fromNodeId: string`, `linkId: string`, `selected?: boolean`. In `buildRfModel`, for cross edges set `data.fromNodeId = e.source`, `data.linkId = e.linkId!`, `data.selected = e.id === selectedLinkEdgeId` (pass a `selectedLinkId?: string` arg, mirroring `selectedId`).
- [ ] **A2.3** `CrosslinkEdge` (edges.ts): when `data.selected`, thicken + add a soft halo.
- [ ] **A2.4** Extend `buildGraph`/`rfModel` tests: a cross edge carries `linkId`; a selected link sets `selected`. run → pass. **A2.5** commit `feat(mindmap): carry linkId on cross edges`.

## Task A3 — draw cross-links

**Files:** modify `Canvas.tsx`, `MindNode.tsx`.

- [ ] **A3.1** `MindNode`: make the Left/Right `Handle`s connectable (`isConnectable` default), `opacity:0` → fade to visible on node hover (Tailwind `group`/`group-hover`); keep them out of the way of the collapse chevron.
- [ ] **A3.2** `Canvas`: `nodesConnectable` on. `onConnect={({ source, target }) => { if (!source || !target) return; const pd = getProjectDoc(activeId); if (!pd) return; const linkId = addCrossLink(pd.doc, source, target); if (linkId) { setTabDirty(activeId, true); selectLink(source, linkId) } }}`.
- [ ] **A3.3** `typecheck`/`lint`; manual: drag handle→handle makes an edge. **A3.4** commit `feat(mindmap): draw cross-links (connect)`.

## Task A4 — edge selection + Edge Inspector

**Files:** modify `useProjectStore.ts`, `Canvas.tsx`, `ProjectView.tsx`; create `EdgeInspector.tsx`.

- [ ] **A4.1** `useProjectStore`: entry `selectedLink: { fromNodeId: string; linkId: string } | null` (init null). Actions: `selectLink(fromNodeId, linkId)` (sets `selectedLink`, clears `selectedId`/`openDoc`); make `select(nodeId)`/`openDocFor` clear `selectedLink`. Canvas passes the selected link's **edge id** to `buildRfModel` for the `selected` flag (edge id = the cross `GraphEdge.id`).
- [ ] **A4.2** `Canvas`: `onEdgeClick={(_e, edge) => { if (edge.type === 'crosslink') { const d = edge.data as RfEdgeData; selectLink(d.fromNodeId, d.linkId) } }}`.
- [ ] **A4.3** `EdgeInspector.tsx` — shown when `selectedLink`; reads the link from the doc (`getProjectDoc(activeId)`, find `links` on `fromNodeId`). Controls:
  - **Type** `<select>` over `Object.entries(linkTypes)` (color swatch + label) → `updateCrossLink(type)` + dirty.
  - **Label** `<input>` → `updateCrossLink(label)` + dirty.
  - **Delete** → `removeCrossLink` + dirty + `selectLink(null)` (clear).
  - **+ New type…** placeholder button (wired in A5).
  Floating panel, bottom-left of the canvas (absolute, `no-drag`).
- [ ] **A4.4** `ProjectView` renders `<EdgeInspector/>` inside the canvas column; the key handler: when `selectedLink` (and no node selected), `Delete`/`Backspace` → `removeCrossLink` + clear.
- [ ] **A4.5** `typecheck`/`lint`; manual: click edge → inspector → retype/relabel/delete; undo/redo. **A4.6** commit `feat(mindmap): edge inspector (retype/relabel/delete)`.

## Task A5 — custom link types + manifest persistence

**Files:** modify `useProjectStore.ts`, `projectActions.ts`, `EdgeInspector.tsx`, `zip.ts`, `index.ts`, `shared/ipc.ts`, `preload/index.ts`, `shared/mindmap/types.ts` (none — manifest already typed).

- [ ] **A5.1** Evolve **`inkproj:save`** to a payload object: `save(workingDir, { schema, manifest?, docs? }, srcPath)`.
  - `zip.ts saveInkproj(workingDir, payload, srcPath)`: write `schema`; if `payload.manifest`, write `manifest.json` (`JSON.stringify(manifest, null, 2)`); for each `payload.docs ?? []`, `safeJoin` + write; then re-zip (unchanged). (`docs` is unused until Phase B but supported now.)
  - Update `index.ts` handler, `preload` (`save(workingDir, payload, srcPath)`), and `saveProject` (pass `{ schema }`, plus `manifest` when `manifestDirty`).
- [ ] **A5.2** `useProjectStore` entry: `manifestLinkTypes: Record<string, LinkType>` (seed from `manifest.linkTypes ?? {}` in `enterProject`), `manifestDirty: boolean`. Action `addLinkType(key, type)` → set in `manifestLinkTypes` + merged `linkTypes` + `manifestDirty=true` + dirty tab; `clearManifestDirty()`.
- [ ] **A5.3** `saveProject`: build `manifest` = `{ ...entry.manifest, linkTypes: entry.manifestLinkTypes }` when `manifestDirty`; on success `clearManifestDirty()`.
- [ ] **A5.4** `EdgeInspector` **+ New type…** → inline mini-form (label + color + arrow `to|none|both`) → `addLinkType(slug(label), {...})` → apply it to the selected link (`updateCrossLink(type: key)`).
- [ ] **A5.5** `typecheck`/`lint`/`build`; manual: add a custom type, apply, Save, reopen → persists. **A5.6** commit `feat(mindmap): custom link types persisted in manifest`.

## Task A6 — Phase A gate

- [ ] **A6.1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **A6.2** Acceptance §7 (Phase A) on `sample.inkproj`. Hand off for QA; commit/merge per OK.

---

# Phase B — doc editing

## Task B1 — editable doc pane + buffer

**Files:** modify `DocPane.tsx`, `useProjectStore.ts`.

- [ ] **B1.1** `useProjectStore` entry: `dirtyDocs: Record<string, string>` (init `{}`). Actions: `setDocBuffer(path, content)` (active tab; sets `dirtyDocs[path]` + marks tab dirty), `clearDirtyDocs()`.
- [ ] **B1.2** `DocPane`: build an **editable** CM (`history()`, `keymap.of([...defaultKeymap, ...historyKeymap])`, `markdown()`, `lineWrapping`, `lineNumbers()`) with an `EditorView.updateListener` → on `update.docChanged`, `setDocBuffer(openDoc.ref.path!, view.state.doc.toString())`. Content source = `dirtyDocs[path] ?? await readDoc(...)`. **External** ref (`ref.external`) → keep the read-only view + a small "external — read only" note (no buffering).
- [ ] **B1.3** `typecheck`/`lint`; manual: type into a doc → tab dirty; switch node + back → edits retained. **B1.4** commit `feat(mindmap): editable doc pane (buffered)`.

## Task B2 — doc ops (attach / create / detach)

**Files:** create `docOps.ts`; modify `zip.ts`, `index.ts`, `shared/ipc.ts`, `preload/index.ts`, `projectEditActions.ts`.

- [ ] **B2.1** Main **`inkproj:attachDoc`**: `attachDoc(workingDir, srcPath)` in `zip.ts` — assert `workingDir` known; `safeJoin(workingDir, 'docs/' + uniqueName(basename(srcPath)))`; copy the file in; return the bundle-relative `path`. The **dialog** lives in `index.ts`: `inkproj:attachDoc` handler opens `showOpenDialog` (md filter), then `attachDoc(workingDir, picked)`, returns `{ path, title }` or null. (D7: main reads only the user-picked path.)
- [ ] **B2.2** `docOps.ts`:
  - `attachDoc(doc, nodeId)` → `const ref = await window.api.inkproj.attachDoc(workingDir); if (ref) pushDocRef(doc, nodeId, ref) + dirty`.
  - `createDoc(doc, nodeId, title)` → `path = docs/${nodeId}.md` (dedupe via `dirtyDocs`/existing), `setDocBuffer(path, '# ' + title + '\n')`, `pushDocRef(doc, nodeId, { path, title })`, open it + dirty.
  - `detachDoc(doc, nodeId, index)` → remove `data.docs[index]` (Yjs transact) + dirty.
  `pushDocRef`/remove read-modify-write `dataJson.docs` under `LOCAL_ORIGIN`.
- [ ] **B2.3** `typecheck`/`lint`; manual: attach a file → copied to `docs/`; create → opens empty; detach → ref gone. **B2.4** commit `feat(mindmap): attach/create/detach docs`.

## Task B3 — DocBar

**Files:** create `DocBar.tsx`; modify `ProjectView.tsx`.

- [ ] **B3.1** `DocBar` (right-pane header, above DocPane): for the selected node — a doc selector (when >1), **New**, **Attach…**, **Detach**; a dirty dot when the open doc is in `dirtyDocs`. No selected node → New/Attach… only.
- [ ] **B3.2** `ProjectView`: render `<DocBar/>` above `<DocPane/>` in the right column.
- [ ] **B3.3** `typecheck`/`lint`; manual: the bar drives open/new/attach/detach. **B3.4** commit `feat(mindmap): doc bar (new/attach/detach)`.

## Task B4 — save docs into the bundle

**Files:** modify `projectActions.ts` (`saveProject`).

- [ ] **B4.1** `saveProject`: include `docs = Object.entries(entry.dirtyDocs).map(([path, content]) => ({ path, content }))` in the save payload (alongside `schema` and the manifest from A5). On success: `clearDirtyDocs()` + `clearManifestDirty()` + `setTabDirty(false)`. (Main already writes docs from A5.1.)
- [ ] **B4.2** `typecheck`/`lint`/`build`; manual: edit a doc + create one → `Cmd/Ctrl+S` → reopen → docs saved; schema/manifest intact. **B4.3** commit `feat(mindmap): save edited docs into the .inkproj`.

## Task B5 — Phase B gate + docs

- [ ] **B5.1** `npx vitest run` green (known `Editor.tab.test.tsx` jsdom error remains); `typecheck`/`lint`/`build` clean.
- [ ] **B5.2** Acceptance §7 (Phase B) on `sample.inkproj`.
- [ ] **B5.3** Update `docs/mindmap/README.md` → M2b shipped.
- [ ] **B5.4** Hand off for manual QA; commit/merge per the user's OK.

---

## Self-review
- **Reuses M2a**: Yjs model, `LOCAL_ORIGIN` undo, save/zip + guard, the toolbar/keys scaffold. New surface = link/doc ops + Edge Inspector + DocBar + editable pane + the bundle-save payload. ✓
- **Pure cores tested on bare Y.Doc** (crossLinkOps; docOps' Yjs parts). ✓
- **Security (D7)**: no new arbitrary-read; attach via main-side dialog only; doc/manifest writes are in-bundle + path-validated; external refs stay read-only. ✓
- **Interop (D1/D4/D5)**: links persist in `data.links`, custom types in `manifest.linkTypes`, docs under `docs/` — all additive, round-trips through `.mind-map`/their reader. ✓
- **Phases independent**: A (cross-links) and B (docs) each ship + QA on their own; the save-payload evolution (A5.1) lands in A and B just fills `docs`. ✓
