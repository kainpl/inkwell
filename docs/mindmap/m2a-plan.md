# Milestone 2a — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Edit a project's tree (add / rename / delete / reparent), undo/redo, and save back to the `.inkproj`. In-memory model is a local **Yjs** doc.

**Architecture:** A `Y.Doc` per project tab (registry in the renderer). Tree = `parentId`+`order` per node; cross-links/docs stay in `dataJson`. Rendering reuses M1: `Yjs → outline → buildGraph → buildRfModel`. Save: `outlineToMarkdown` → re-zip working dir → atomic overwrite of the source `.inkproj`. Spec: [`m2a-spec.md`](m2a-spec.md).

**Conventions:** transactions tagged `LOCAL_ORIGIN` for undo grouping; pure helpers unit-tested on a bare `Y.Doc` (no React); IPC via `shared/ipc.ts`; commit per green task-group during build, but during the hands-on QA loop commit only on the user's OK.

---

## File structure

```
src/renderer/src/lib/mindmap/
  yjsModel.ts          outlineToYjs / yjsToOutline / genId / LOCAL_ORIGIN
  yjsModel.test.ts
  treeOps.ts           addChild / addSibling / rename / remove / reparent
  treeOps.test.ts
  yjsRegistry.ts       Map<tabId,{doc,undo,srcPath}> — create/get/destroy
  projectActions.ts    (modify) seed doc on open; destroy on close; saveProject
  useProjectGraph.ts   hook: subscribe a tab's Y.Doc -> GraphModel
src/renderer/src/store/
  useProjectStore.ts   (modify) entry: { srcPath } + collapsed/selectedId/openDoc
  useAppStore.ts       (modify) setTabDirty(id, dirty)
src/renderer/src/components/Mindmap/
  Canvas.tsx           (modify) graph via useProjectGraph; nodesDraggable; onNodeDragStop reparent
  MindNode.tsx         (modify) inline rename (contentEditable)
  EditToolbar.tsx      add child/sibling/delete/undo/redo/save
  ProjectView.tsx      (modify) render EditToolbar
src/main/inkproj/{zip.ts,index.ts}   saveInkproj + inkproj:save IPC; srcPath
src/shared/mindmap/types.ts          OpenedInkproj.srcPath
src/shared/ipc.ts, src/preload/index.ts   inkprojSave channel + window.api.inkproj.save
src/renderer/src/App.tsx             Cmd+S -> saveProject for project tabs; undo/redo + edit keys
package.json                         + yjs
```

---

## Task 1 — yjs dep + model conversions

**Files:** modify `package.json`; create `lib/mindmap/yjsModel.ts`, `yjsModel.test.ts`.

- [ ] **1.1** `npm i yjs`
- [ ] **1.2 Failing test** `yjsModel.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { outlineToYjs, yjsToOutline } from './yjsModel'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

const seed = (md: string) => {
  const doc = new Y.Doc()
  const { outline, title } = markdownToOutline(md)
  outlineToYjs(doc, outline, title)
  return doc
}

describe('yjs model', () => {
  it('round-trips outline -> Y.Doc -> outline (structure, names, data)', () => {
    const md = '# R\n\n- A <!-- mindmap {"id":"a","color":"#4af"} -->\n  - B <!-- mindmap {"id":"b"} -->\n- C\n'
    const { outline } = markdownToOutline(md)
    const back = yjsToOutline(seed(md))
    expect(back[0].children?.map((n) => n.name)).toEqual(outline[0].children?.map((n) => n.name))
    expect(back[0].children?.[0].data).toMatchObject({ id: 'a', color: '#4af' })
  })
  it('assigns a stable id to a node that lacked one', () => {
    const back = yjsToOutline(seed('# R\n\n- X\n'))
    expect(typeof back[0].children?.[0].data?.id).toBe('string')
  })
})
```
- [ ] **1.3 Implement** `yjsModel.ts`
```ts
import * as Y from 'yjs'
import type { MarkdownNode, NodeData } from '@shared/mindmap/types'

export const LOCAL_ORIGIN = Symbol('inkproj-local')

let counter = 0
export const genId = (): string => `n-${Date.now().toString(36)}-${(counter++).toString(36)}`

type Nodes = Y.Map<Y.Map<unknown>>
export const nodesOf = (doc: Y.Doc): Nodes => doc.getMap('nodes') as Nodes

function writeNode(nodes: Nodes, id: string, name: string, parentId: string | null, order: number, data: NodeData): void {
  const m = new Y.Map<unknown>()
  m.set('name', name)
  m.set('parentId', parentId)
  m.set('order', order)
  m.set('dataJson', JSON.stringify({ ...data, id }))
  nodes.set(id, m)
}

/** Seed a fresh doc from a parsed outline (ids assigned where missing). */
export function outlineToYjs(doc: Y.Doc, outline: MarkdownNode[], title = ''): void {
  const nodes = nodesOf(doc)
  doc.getMap('meta').set('title', title)
  doc.transact(() => {
    const walk = (node: MarkdownNode, parentId: string | null, order: number): void => {
      const data = (node.data ?? {}) as NodeData
      const id = typeof data.id === 'string' && data.id ? data.id : genId()
      writeNode(nodes, id, node.name ?? '', parentId, order, { ...data, id })
      ;(node.children ?? []).forEach((c, i) => walk(c, id, i))
    }
    outline.forEach((root, i) => walk(root, null, i))
  })
}

/** Rebuild the outline tree from the doc (sorted by `order`). */
export function yjsToOutline(doc: Y.Doc): MarkdownNode[] {
  const nodes = nodesOf(doc)
  interface Row { id: string; name: string; parentId: string | null; order: number; data: NodeData }
  const byParent = new Map<string | null, Row[]>()
  nodes.forEach((m, id) => {
    const row: Row = {
      id,
      name: (m.get('name') as string) ?? '',
      parentId: (m.get('parentId') as string | null) ?? null,
      order: (m.get('order') as number) ?? 0,
      data: JSON.parse((m.get('dataJson') as string) || '{}') as NodeData
    }
    const arr = byParent.get(row.parentId) ?? []
    arr.push(row)
    byParent.set(row.parentId, arr)
  })
  for (const arr of byParent.values()) arr.sort((a, b) => a.order - b.order)
  const build = (row: Row): MarkdownNode => ({
    name: row.name,
    data: row.data,
    children: (byParent.get(row.id) ?? []).map(build)
  })
  return (byParent.get(null) ?? []).map(build)
}
```
- [ ] **1.4** run → pass. **1.5** commit `feat(mindmap): yjs model conversions`.

---

## Task 2 — tree edit operations

**Files:** create `treeOps.ts`, `treeOps.test.ts`.

- [ ] **2.1 Failing test** — on a bare `Y.Doc` seeded via `outlineToYjs`:
  - `addChild(doc, 'a')` → a new node with `parentId==='a'`; `yjsToOutline` shows it under A.
  - `rename(doc, id, 'X')` → name updates.
  - `remove(doc, 'a')` → A and its descendants gone; a cross-link `to:'a'` on another node is stripped.
  - `reparent(doc, 'b', 'c')` → B moves under C; `reparent(doc, 'a', <descendant-of-a>)` is rejected (cycle).
- [ ] **2.2 Implement** `treeOps.ts` — each op wraps `doc.transact(fn, LOCAL_ORIGIN)`:
```ts
import * as Y from 'yjs'
import type { NodeData } from '@shared/mindmap/types'
import { LOCAL_ORIGIN, genId, nodesOf } from './yjsModel'

const childIds = (nodes: Y.Map<Y.Map<unknown>>, parentId: string | null): string[] => {
  const rows: { id: string; order: number }[] = []
  nodes.forEach((m, id) => {
    if (((m.get('parentId') as string | null) ?? null) === parentId) rows.push({ id, order: m.get('order') as number })
  })
  return rows.sort((a, b) => a.order - b.order).map((r) => r.id)
}
const nextOrder = (nodes: Y.Map<Y.Map<unknown>>, parentId: string | null): number => {
  let mx = -1
  nodes.forEach((m) => {
    if (((m.get('parentId') as string | null) ?? null) === parentId) mx = Math.max(mx, m.get('order') as number)
  })
  return mx + 1
}
function makeNode(parentId: string | null, order: number, id: string): Y.Map<unknown> {
  const m = new Y.Map<unknown>()
  m.set('name', '')
  m.set('parentId', parentId)
  m.set('order', order)
  m.set('dataJson', JSON.stringify({ id }))
  return m
}

export function addChild(doc: Y.Doc, parentId: string): string {
  const nodes = nodesOf(doc)
  const id = genId()
  doc.transact(() => nodes.set(id, makeNode(parentId, nextOrder(nodes, parentId), id)), LOCAL_ORIGIN)
  return id
}
export function addSibling(doc: Y.Doc, nodeId: string): string {
  const nodes = nodesOf(doc)
  const parentId = (nodes.get(nodeId)?.get('parentId') as string | null) ?? null
  const id = genId()
  doc.transact(() => nodes.set(id, makeNode(parentId, nextOrder(nodes, parentId), id)), LOCAL_ORIGIN)
  return id
}
export function rename(doc: Y.Doc, nodeId: string, name: string): void {
  const m = nodesOf(doc).get(nodeId)
  if (m) doc.transact(() => m.set('name', name), LOCAL_ORIGIN)
}
function descendants(nodes: Y.Map<Y.Map<unknown>>, root: string): Set<string> {
  const out = new Set<string>()
  const visit = (id: string): void => {
    for (const c of childIds(nodes, id)) { out.add(c); visit(c) }
  }
  visit(root)
  return out
}
export function remove(doc: Y.Doc, nodeId: string): void {
  const nodes = nodesOf(doc)
  const doomed = new Set([nodeId, ...descendants(nodes, nodeId)])
  doc.transact(() => {
    for (const id of doomed) nodes.delete(id)
    // strip cross-links that point at a removed node
    nodes.forEach((m) => {
      const data = JSON.parse((m.get('dataJson') as string) || '{}') as NodeData
      if (!Array.isArray(data.links)) return
      const kept = data.links.filter((l) => !doomed.has(l.to))
      if (kept.length !== data.links.length) m.set('dataJson', JSON.stringify({ ...data, links: kept }))
    })
  }, LOCAL_ORIGIN)
}
export function reparent(doc: Y.Doc, nodeId: string, newParentId: string): boolean {
  const nodes = nodesOf(doc)
  if (nodeId === newParentId || descendants(nodes, nodeId).has(newParentId)) return false
  const m = nodes.get(nodeId)
  if (!m) return false
  doc.transact(() => {
    m.set('parentId', newParentId)
    m.set('order', nextOrder(nodes, newParentId))
  }, LOCAL_ORIGIN)
  return true
}
```
- [ ] **2.3** run → pass. **2.4** commit `feat(mindmap): tree edit ops (yjs transactions)`.

---

## Task 3 — srcPath plumbing + save IPC

**Files:** modify `shared/mindmap/types.ts`, `main/inkproj/zip.ts`, `main/inkproj/index.ts`, `shared/ipc.ts`, `preload/index.ts`.

- [ ] **3.1** `OpenedInkproj` gains `srcPath: string`. `openInkproj(srcPath, base)` returns it. Track it in a `Map<workingDir, srcPath>` alongside `KNOWN_WORKING_DIRS` (or fold both into one `Map`).
- [ ] **3.2 Failing test** (`zip.test.ts`): open a fixture, write a new schema via `saveInkproj(workingDir, '# T2\n\n- Z\n', srcPath)`, re-open `srcPath`, assert the schema now contains `Z`.
- [ ] **3.3 Implement** `saveInkproj(workingDir, schemaText, srcPath)` in `zip.ts`: assert `workingDir` known and `srcPath` matches the stored one; write `schemaText` to `<workingDir>/schema.mind-map`; zip the working dir (jszip) → temp file → atomic `rename` over `srcPath`.
- [ ] **3.4** IPC `inkprojSave: 'inkproj:save'`; `registerInkprojIpc` handles it; preload `window.api.inkproj.save(workingDir, schemaText, srcPath)`. `inkproj:open`/`openDialog` already return `OpenedInkproj` (now with `srcPath`).
- [ ] **3.5** run zip test → pass; `typecheck`. **3.6** commit `feat(mindmap): inkproj save (zip-back) + srcPath`.

---

## Task 4 — registry, store, graph hook

**Files:** create `yjsRegistry.ts`, `useProjectGraph.ts`; modify `useProjectStore.ts`, `useAppStore.ts`, `projectActions.ts`.

- [x] **4.1** `yjsRegistry.ts` — `Map<tabId, { doc: Y.Doc; undo: Y.UndoManager; srcPath: string }>`; `createProjectDoc(tabId, outline, title, srcPath)` (seeds via `outlineToYjs`, makes a `Y.UndoManager(nodesOf(doc), { trackedOrigins: new Set([LOCAL_ORIGIN]), captureTimeout: 400 })`); `getProjectDoc(tabId)`; `destroyProjectDoc(tabId)` (`doc.destroy()`).
- [x] **4.2** `useProjectStore` entry: replace `graph` with `srcPath` (keep `workingDir/manifest/linkTypes/collapsed/selectedId/openDoc`). `setProjectForTab` no longer stores a static graph — it calls `createProjectDoc(...)`.
- [x] **4.3** `useAppStore`: add `setTabDirty(id, dirty)` (sets the tab's + mirrors `doc.dirty` when active).
- [x] **4.4** `useProjectGraph(tabId)` hook: `useSyncExternalStore` over the tab's `Y.Doc` (`nodes.observeDeep`), returning a memoized `buildGraph(yjsToOutline(doc))`. Returns `null` if no doc.
- [x] **4.5** `projectActions`: `enterProject` creates the tab, then `createProjectDoc(tabId, outline, title, srcPath)`, then `setProjectForTab`. `cleanupProjectTab` also `destroyProjectDoc(tabId)`.
- [x] **4.6** `typecheck`. **4.7** commit `feat(mindmap): yjs registry + project-graph hook + dirty`. (`752069b`)

---

## Task 5 — render from Yjs

**Files:** modify `Canvas.tsx`.

- [x] **5.1** Canvas: `const graph = useProjectGraph(activeTabId)` instead of `project.graph`; keep `collapsed/selectedId/linkTypes` from `useActiveProject`. (`activeTabId` from `useAppStore`.)
- [x] **5.2 Verify** M1 still renders the fixture unchanged (manual) + full unit suite green (no static-graph regressions). **5.3** commit `refactor(mindmap): render canvas from the yjs model`. (folded into `752069b`)

---

## Task 6 — edit UI (toolbar + inline rename + keys + dirty)

**Files:** create `EditToolbar.tsx`; modify `MindNode.tsx`, `ProjectView.tsx`, `App.tsx`.

- [x] **6.1** `EditToolbar` — buttons: Add child / Add sibling (enabled when a node is selected), Delete, Undo, Redo, Save (enabled when dirty). Each calls the matching `treeOps`/registry action on the active doc + selected node; mutating ops call `setTabDirty(tabId, true)`. (Edit ops centralized in `projectEditActions.ts`, shared with keys/rename.)
- [x] **6.2** `MindNode` inline rename: double-click → input (instead of `contentEditable`); Enter commits `rename(doc, id, text)` + dirty; Esc cancels; blur commits. New node auto-enters edit (`beginEdit` from create actions).
- [x] **6.3** `ProjectView` renders `<EditToolbar/>` in its header strip.
- [x] **6.4** Keyboard (project-tab-scoped window listener in `ProjectView`): `Tab`=addChild(selected), `Enter`=addSibling, `F2`=rename, `Delete`/`Backspace`=remove, all dirty-marking; ignores typing/interactive targets.
- [x] **6.5** `typecheck`/`lint` green (runtime add/rename/delete verified in Task 10 QA). **6.6** commit `feat(mindmap): node create/rename/delete UI`.

---

## Task 7 — reparent by drag

**Files:** modify `Canvas.tsx`.

- [x] **7.1** Canvas keeps a local node copy (controlled-flow pattern) so a drag is visible; `onNodeDragStop` finds the nearest *other* node within `REPARENT_RADIUS` (140px); if found, `reparent(doc, node.id, target.id)` + dirty (model change re-lays-out); else `setNodes(model.nodes)` snaps back. `nodesDraggable` defaults on (Canvas only mounts for project tabs).
- [x] **7.2** runtime drag verified in Task 10 QA. **7.3** commit `feat(mindmap): reparent by drag`.

---

## Task 8 — undo / redo

**Files:** modify `App.tsx` (or a project-scoped key handler).

- [x] **8.1** `ProjectView`'s project-scoped key handler: `Ctrl/Cmd+Z` → `undoActive` (`getProjectDoc(tabId).undo.undo()` guarded by `canUndo`), `Shift` / `Ctrl/Cmd+Y` → `redoActive`; marks dirty. Ignores typing/interactive targets; a file tab never reaches here (ProjectView unmounts → CodeMirror owns Ctrl+Z).
- [x] **8.2** runtime undo/redo + rename coalescing verified in Task 10 QA. **8.3** commit `feat(mindmap): project undo/redo`.

---

## Task 9 — save + dirty/guard

**Files:** modify `projectActions.ts`, `App.tsx`.

- [x] **9.1** `saveProject(tabId)`: `outlineToMarkdown(yjsToOutline(doc), title)` → `window.api.inkproj.save(workingDir, schema, srcPath)` → on success `setTabDirty(tabId, false)`. (Task 4.)
- [x] **9.2** `docActions.saveCurrent()` branches on tab kind (project → `saveProject`, else `saveDoc`); App `menuSave`/`menuSaveAs` and the toolbar Save button all route through it; `guardUnsaved`'s "save" choice uses it too.
- [x] **9.3** Unsaved guard reuses `closeTabById`/`guardAllTabs`, which activate the tab then run `guardUnsaved` (now `doc.dirty` mirrors the project tab via `setTabDirty`). Also guarded `draftAutoSave` from generating drafts for path-less project tabs.
- [x] **9.4** runtime Cmd+S round-trip verified in Task 10 QA. **9.5** commit `feat(mindmap): save project (Cmd+S, zip-back) + guard`.

---

## Task 10 — acceptance + green gate

- [x] **10.1** M2a acceptance (spec §9) on `sample.inkproj` — add/rename/delete/reparent, undo/redo, save round-trip, dirty + guard, file editing untouched. **Manual QA passed.**
- [x] **10.2** `npx vitest run` green (395 pass; known `Editor.tab.test.tsx` jsdom teardown error remains), `typecheck`/`lint`/`build` clean.
- [x] **10.3** Update `docs/mindmap/README.md` status → M2a shipped.
- [x] **10.4** Manual QA accepted; committed + pushed to origin.

---

## Self-review

- **Reuses M1**: rendering (`buildGraph`/`buildRfModel`/Canvas/MindNode), `outlineToMarkdown`, the inkproj IPC + working-dir security. New surface = the Yjs model + edit ops + save. ✓
- **Pure cores tested on bare Y.Doc** (yjsModel, treeOps) — no React needed. ✓
- **Security**: save reuses the known-working-dir guard; `srcPath` validated against the one we opened. ✓
- **No file-flow regression**: project tabs stay path-less; Save/undo/keys branch on active tab kind. ✓
