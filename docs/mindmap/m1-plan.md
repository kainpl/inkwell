# Milestone 1 — implementation plan

> **For agentic workers:** REQUIRED SUB‑SKILL: use superpowers:subagent‑driven‑development (or executing‑plans) to implement task‑by‑task. Steps use `- [ ]` checkboxes.

**Goal:** Open a `.inkproj`, render its schema (tree + typed cross‑links) on a React Flow canvas, click a node → open its doc in a read‑only CodeMirror pane scrolled to the anchor. Read‑only; no save.

**Architecture:** Pure format/graph logic in `src/shared/mindmap` + `src/renderer/src/lib/mindmap` (renderer‑agnostic, D8). ZIP read + working‑dir in the main process behind `window.api.inkproj.*` (D12, renderer never touches fs). React Flow canvas + a read‑only `DocPane` in a split `ProjectView`.

**Tech:** `@xyflow/react`, `d3-hierarchy`, `jszip` (main), existing CodeMirror + heading‑id logic. Spec: [`m1-spec.md`](m1-spec.md); decisions: [`our-vision.md`](our-vision.md) §6 (D1–D13).

**Conventions:** match Inkwell — IPC via `src/shared/ipc.ts` `IPC` object → preload `window.api` → renderer; state via `useAppStore`; no `any`; pure helpers unit‑tested with Vitest; commit only when the user asks.

---

## File structure

```
src/shared/mindmap/
  types.ts                 MarkdownNode, InkprojManifest, NodeData, LinkType, GraphModel
  mindMapMarkdown.ts       markdownToOutline / outlineToMarkdown  (port of source lib)
  mindMapMarkdown.test.ts
src/renderer/src/lib/mindmap/
  linkTypes.ts             BUILTIN_LINK_TYPES + mergeLinkTypes(manifest)
  linkTypes.test.ts
  buildGraph.ts            outline + manifest -> { nodes, edges, index }
  buildGraph.test.ts
  layout.ts                d3-hierarchy tidy tree; honor pins
  layout.test.ts
  anchors.ts               resolveAnchor(text, "#id") -> { line, ch } | null   (#heading {#id} + block ^id)
  anchors.test.ts
src/main/inkproj/
  zip.ts                   extractInkproj(path) -> workingDir ; readDocFile(...)
  index.ts                 registerInkprojIpc(): inkproj:open / inkproj:readDoc / cleanup
src/renderer/src/store/useProjectStore.ts   project state (manifest, graph, workingDir, openDoc)
src/renderer/src/components/Mindmap/
  ProjectView.tsx          split: <Canvas/> | <DocPane/>
  Canvas.tsx               React Flow wiring (nodes/edges/layout/collapse)
  MindNode.tsx             custom node
  edges.ts                 TreeEdge / CrosslinkEdge types
  DocPane.tsx              read-only CodeMirror + anchor scroll
scripts/make-fixture-inkproj.mjs            builds resources/fixtures/sample.inkproj
src/shared/ipc.ts          + inkproj channels
src/preload/index.ts       + window.api.inkproj
electron-builder.yml       + .inkproj fileAssociation
```

---

## Task 1 — Deps + shared types

**Files:** Modify `package.json`; Create `src/shared/mindmap/types.ts`.

- [ ] **1.1 Install deps**
```bash
npm i @xyflow/react d3-hierarchy jszip
npm i -D @types/d3-hierarchy
```
- [ ] **1.2 Write `src/shared/mindmap/types.ts`**
```ts
/** One node in the schema outline (mirrors the source `.mind-map` model). */
export interface MarkdownNode { name: string; children?: MarkdownNode[]; data?: NodeData }

/** Per-node data bag. Open-ended (forward-compat); these are the M1-consumed keys. */
export interface NodeData {
  id?: string
  links?: CrossLink[]
  docs?: DocRef[]
  labelHtml?: string
  color?: string; lineColor?: string; fillColor?: string; shape?: string
  icon?: string[]; tag?: string[]
  task?: boolean; taskStatus?: 'open' | 'done' | 'cancelled'; taskType?: string
  expand?: boolean
  offsetX?: number; offsetY?: number; customLeft?: number; customTop?: number
  [k: string]: unknown
}
export interface CrossLink { id: string; to: string; type: string; label?: string; file?: string }
export interface DocRef { path?: string; anchor?: string; title?: string; external?: boolean; src?: string }

export interface LinkType { label: string; color: string; arrow?: 'to' | 'none' | 'both'; directed?: boolean; icon?: string }

export interface InkprojManifest {
  format: 'inkproj'; formatVersion: number; app?: string; appVersion?: string
  title?: string; createdAt?: string; updatedAt?: string
  schema?: string; linkTypes?: Record<string, LinkType>
}

/** Renderer graph model (engine-agnostic — D8). */
export interface GraphNode { id: string; label: string; depth: number; parentId: string | null; data: NodeData }
export interface GraphEdge { id: string; source: string; target: string; kind: 'tree' | 'cross'; type?: string }
export interface GraphModel {
  nodes: GraphNode[]; edges: GraphEdge[]
  childrenOf: Map<string, string[]>; incomingCross: Map<string, GraphEdge[]>
}
```
- [ ] **1.3 Verify** `npm run typecheck` (expect clean).
- [ ] **1.4 Commit** (when the user asks) — `chore(mindmap): add deps + shared types`.

---

## Task 2 — Port the `.mind-map` parser/serializer

**Files:** Create `src/shared/mindmap/mindMapMarkdown.ts`, `mindMapMarkdown.test.ts`. **Reference:** `temp/ref/ai-protocolist-dev/libs/shared/src/mind-map-markdown.ts`.

- [ ] **2.1 Write failing round‑trip test** `mindMapMarkdown.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { markdownToOutline, outlineToMarkdown } from './mindMapMarkdown'

describe('mind-map markdown', () => {
  it('parses frontmatter + nested bullets + per-node data', () => {
    const md = [
      '---', 'title: T', '---', '', '# T', '',
      '- A <!-- mindmap {"id":"a","color":"#4af"} -->',
      '  - B <!-- mindmap {"id":"b"} -->',
      '- C'
    ].join('\n')
    const { title, outline } = markdownToOutline(md)
    expect(title).toBe('T')
    // implicit root: single root == title -> children are the bullets
    expect(outline[0].name).toBe('T')
    expect(outline[0].children?.map((n) => n.name)).toEqual(['A', 'C'])
    expect(outline[0].children?.[0].data).toMatchObject({ id: 'a', color: '#4af' })
    expect(outline[0].children?.[0].children?.[0]).toMatchObject({ name: 'B' })
  })
  it('round-trips losslessly', () => {
    const md = '---\ntitle: T\n---\n\n# T\n\n- A <!-- mindmap {"id":"a"} -->\n'
    const { title, outline } = markdownToOutline(md)
    const out = markdownToOutline(outlineToMarkdown(outline, title))
    expect(out.outline).toEqual(outline)
  })
})
```
- [ ] **2.2 Run → fails** `npx vitest run src/shared/mindmap/mindMapMarkdown.test.ts`.
- [ ] **2.3 Port the implementation** — copy `outlineToMarkdown`, `markdownToOutline`, and their private helpers (`appendNode`, `encodeNodeMeta`, `decodeNodeMeta`, `parseBulletList`, `extractFrontMatter`, `stripFrontMatter`, `extractH1WithMeta`, `pickImplicitRoot`, `yamlScalar`, `sanitizeLine`, sentinels) from the reference file into `mindMapMarkdown.ts`. **Drop** the source‑only deps: remove the `normalizeTaskMetadata` import (inline a no‑op or port `mind-map-task-metadata.ts` in a later milestone) and the `FORMAT_SPEC_URL` stamp (or hardcode an Inkwell URL). Keep types importing from `./types`.
- [ ] **2.4 Run → passes.**
- [ ] **2.5 Commit** — `feat(mindmap): port .mind-map parser/serializer`.

---

## Task 3 — Link‑type registry

**Files:** Create `linkTypes.ts`, `linkTypes.test.ts`.

- [ ] **3.1 Failing test**
```ts
import { BUILTIN_LINK_TYPES, mergeLinkTypes } from './linkTypes'
it('merges manifest overrides + custom over built-ins', () => {
  const r = mergeLinkTypes({ 'depends-on': { label: 'X', color: '#111' }, custom: { label: 'C', color: '#222' } })
  expect(r['relates-to']).toEqual(BUILTIN_LINK_TYPES['relates-to'])   // untouched built-in
  expect(r['depends-on'].label).toBe('X')                              // override
  expect(r.custom).toMatchObject({ label: 'C', color: '#222' })        // first-class custom
})
it('falls back for unknown type', () => {
  const r = mergeLinkTypes()
  expect(r['relates-to']).toBeDefined()
})
```
- [ ] **3.2 Implement**
```ts
import type { LinkType } from '@shared/mindmap/types'
export const BUILTIN_LINK_TYPES: Record<string, LinkType> = {
  'relates-to': { label: 'relates to', color: '#7a8aa0', arrow: 'none', directed: false },
  'depends-on': { label: 'depends on', color: '#e0772b', arrow: 'to', directed: true },
  references:   { label: 'references', color: '#4a86d9', arrow: 'to', directed: true },
  blocks:       { label: 'blocks', color: '#d35454', arrow: 'to', directed: true },
  duplicates:   { label: 'duplicates', color: '#9b59b6', arrow: 'both', directed: false },
  'see-also':   { label: 'see also', color: '#3a9e4a', arrow: 'none', directed: false }
}
export function mergeLinkTypes(manifest?: Record<string, Partial<LinkType>>): Record<string, LinkType> {
  const out: Record<string, LinkType> = structuredClone(BUILTIN_LINK_TYPES)
  for (const [k, v] of Object.entries(manifest ?? {})) {
    out[k] = { ...(out[k] ?? { label: k, color: '#7a8aa0' }), ...v } as LinkType
  }
  return out
}
/** Visual fallback for a type not in the registry. */
export const resolveLinkType = (reg: Record<string, LinkType>, type: string): LinkType =>
  reg[type] ?? { label: type, color: '#7a8aa0', arrow: 'to', directed: true }
```
- [ ] **3.3 Run → passes. 3.4 Commit** — `feat(mindmap): link-type registry`.

---

## Task 4 — buildGraph (outline → nodes/edges/index)

**Files:** Create `buildGraph.ts`, `buildGraph.test.ts`.

- [ ] **4.1 Failing test**
```ts
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
it('flattens tree, derives ids, builds cross + reverse index', () => {
  const md = '# R\n\n- A <!-- mindmap {"id":"a","links":[{"id":"e1","to":"b","type":"depends-on"}]} -->\n- B <!-- mindmap {"id":"b"} -->\n'
  const { outline } = markdownToOutline(md)
  const g = buildGraph(outline)
  expect(g.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b']))
  expect(g.edges.filter((e) => e.kind === 'cross')).toEqual([
    expect.objectContaining({ id: 'e1', source: 'a', target: 'b', type: 'depends-on' })
  ])
  expect(g.incomingCross.get('b')?.[0]?.source).toBe('a')
})
it('derives a stable id when missing', () => {
  const { outline } = markdownToOutline('# R\n\n- X\n')
  const g = buildGraph(outline)
  expect(g.nodes.find((n) => n.label === 'X')?.id).toBeTruthy()
})
```
- [ ] **4.2 Implement** — recursive walk: assign `id` (`data.id` ?? deterministic `path-index` id), push `GraphNode`, push tree `GraphEdge` for parent→child, collect `data.links[]` into cross edges; build `childrenOf` + `incomingCross` maps. Skip cross edges whose `to` resolves to no node (log via a passed `onWarn?`).
- [ ] **4.3 Run → passes. 4.4 Commit** — `feat(mindmap): buildGraph + in-memory index`.

---

## Task 5 — Layout (d3‑hierarchy, honor pins)

**Files:** Create `layout.ts`, `layout.test.ts`. **Reference:** `temp/ref/ai-protocolist-dev/apps/web/src/components/mind-map/rf/layout.ts`.

- [ ] **5.1 Failing test** — given a 3‑node tree (root + 2 children), `computeLayout(graph)` returns a `Map<id,{x,y}>` with both children sharing the root’s primary axis offset and distinct cross‑axis positions; a node with `offsetX/offsetY` (or `customLeft/customTop`) keeps the pinned coordinate.
- [ ] **5.2 Implement** — build a `d3.hierarchy` from `childrenOf`, run `d3.tree().nodeSize([nodeSep, rankSep])`, map to `{x,y}` for RIGHT growth (x = depth axis). After computing auto positions, **override** with pins: `customLeft/customTop` (absolute) or `offsetX/offsetY` (delta from the auto slot).
- [ ] **5.3 Run → passes. 5.4 Commit** — `feat(mindmap): tree layout with pin honoring`.

---

## Task 6 — Anchor resolver

**Files:** Create `anchors.ts`, `anchors.test.ts`. **Reuse:** Inkwell’s existing heading‑id parsing (`lib/outline.ts` / `livePreview` `{#id}` logic).

- [ ] **6.1 Failing test**
```ts
import { resolveAnchor } from './anchors'
const doc = '# Intro\n\n## Estimate {#estimate}\n\ntext\n\nA line ^blk1\n'
it('resolves {#id} heading anchor', () => {
  expect(resolveAnchor(doc, '#estimate')?.line).toBe(2)
})
it('resolves ^id block anchor', () => {
  expect(resolveAnchor(doc, '#blk1')?.line).toBe(6)
})
it('returns null when missing', () => {
  expect(resolveAnchor(doc, '#nope')).toBeNull()
})
```
- [ ] **6.2 Implement** — scan lines: match a heading carrying `{#<id>}` OR a line ending with `^<id>`; return `{ line, ch }` of the first match (0‑based line). `resolveAnchor(text, '#id')` strips the leading `#`.
- [ ] **6.3 Run → passes. 6.4 Commit** — `feat(mindmap): anchor resolver ({#id} + ^id)`.

---

## Task 7 — Main: ZIP read + working dir

**Files:** Create `src/main/inkproj/zip.ts`. **Lib:** `jszip` + `node:fs/promises`, `node:os`, `node:path`.

- [ ] **7.1 Failing test** `zip.test.ts` (node env) — zip a temp folder (`manifest.json` + `schema.mind-map` + `docs/x.md`) into a buffer with jszip, call `extractInkproj(buf or path)`, assert the working dir contains the three files and `readManifestAndSchema(dir)` returns the parsed manifest + schema text.
- [ ] **7.2 Implement** — `extractInkproj(srcPath): Promise<{ workingDir }>` extracts every entry under `os.tmpdir()/inkwell-inkproj/<uuid>/` (path‑traversal guard: reject entries that resolve outside the dir). `readDocFile(workingDir, ref)` reads an internal `docs/...` path or, when `ref.external`, the absolute `ref.src`. `cleanup(workingDir)` removes it. (uuid via a counter + timestamp passed in — avoid `Math.random`/`Date.now` only if running under the workflow runner; in main process they’re fine.)
- [ ] **7.3 Run → passes. 7.4 Commit** — `feat(mindmap): inkproj zip extract + read (main)`.

---

## Task 8 — IPC contract + preload

**Files:** Modify `src/shared/ipc.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`; Create `src/main/inkproj/index.ts`; register in `src/main/index.ts`.

- [ ] **8.1** Add channels to `IPC`: `inkprojOpen: 'inkproj:open'`, `inkprojReadDoc: 'inkproj:readDoc'`, `inkprojClose: 'inkproj:close'`.
- [ ] **8.2** `registerInkprojIpc()` (main): `handle(inkprojOpen, path)` → `extractInkproj` + `readManifestAndSchema` → `{ manifest, schema, workingDir }`; `handle(inkprojReadDoc, {workingDir, ref})` → text; `handle(inkprojClose, workingDir)` → cleanup. Call it from `main/index.ts` alongside the other `registerXxxIpc()`.
- [ ] **8.3** Preload: expose `window.api.inkproj = { open, readDoc, close }` (typed via shared types). Update `index.d.ts`.
- [ ] **8.4 Verify** `npm run typecheck` + `npm run build` (bundles main/preload). 
- [ ] **8.5 Commit** — `feat(mindmap): inkproj IPC + preload surface`.

---

## Task 9 — Sample fixture

**Files:** Create `scripts/make-fixture-inkproj.mjs`; output `resources/fixtures/sample.inkproj` (gitignore the artifact, keep the script + source folder).

- [ ] **9.1** Script zips a small `manifest.json` + `schema.mind-map` (the §4 example) + `docs/services.md` + `docs/research/notes.md` (with a `## Estimate {#estimate}` heading and a `^blk1` line) into `sample.inkproj`.
- [ ] **9.2** `node scripts/make-fixture-inkproj.mjs` → file exists; manually open later.
- [ ] **9.3 Commit** — `chore(mindmap): sample .inkproj fixture script`.

---

## Task 10 — React Flow canvas (render only)

**Files:** Create `components/Mindmap/{Canvas.tsx, MindNode.tsx, edges.ts}`; `store/useProjectStore.ts`.

- [ ] **10.1** `useProjectStore` — `{ manifest, graph, linkTypes, workingDir, collapsed: Set<id>, openDocFor(nodeId), setProject(...) }`.
- [ ] **10.2** `MindNode.tsx` — custom node: caption (`labelHtml` sanitized else `label`), icon/tag/task badge, collapse chevron when `childrenOf` non‑empty. `nodesDraggable={false}`, handles invisible.
- [ ] **10.3** `edges.ts` — `TreeEdge` (neutral step) + `CrosslinkEdge` (color/arrow/label from `resolveLinkType`).
- [ ] **10.4** `Canvas.tsx` — map `graph` + `computeLayout` → RF `nodes`/`edges` (filter collapsed subtrees), `nodeTypes={{mind:MindNode}}`, `edgeTypes={{tree:TreeEdge, crosslink:CrosslinkEdge}}`, `<Background/><Controls/><MiniMap/>`, `onlyRenderVisibleElements`, `fitView`. Lazy‑import via `next/dynamic` equivalent — here just a normal import (Electron renderer; React Flow is fine).
- [ ] **10.5 Verify** — a light test that `buildRfModel(graph, layout, collapsed)` (pure helper extracted from Canvas) returns expected RF nodes/edges and drops collapsed children. Manual: render against the fixture.
- [ ] **10.6 Commit** — `feat(mindmap): react-flow canvas render`.

---

## Task 11 — Collapse/expand + cross‑link highlight

- [ ] **11.1** Chevron toggles `collapsed` set; `buildRfModel` hides descendants of any collapsed node (cascade). Add a unit test for the cascade.
- [ ] **11.2** Selecting a node highlights its incident cross‑links (use `incomingCross` + outgoing `links`); dim others. 
- [ ] **11.3 Commit** — `feat(mindmap): collapse + cross-link highlight`.

---

## Task 12 — DocPane (read‑only CM + anchor scroll)

**Files:** Create `components/Mindmap/DocPane.tsx`. **Reuse** Inkwell’s CodeMirror setup in read‑only mode (`EditorState.readOnly.of(true)` + `EditorView.editable.of(false)`).

- [ ] **12.1** On `openDocFor(nodeId)`: take `data.docs[0]`, `window.api.inkproj.readDoc({workingDir, ref})` → text → mount a read‑only CM. If `ref.anchor`, `resolveAnchor(text, anchor)` → scroll the line into view + transient highlight; on null, open at top + a non‑blocking toast.
- [ ] **12.2** Node with no `docs` → empty‑state pane.
- [ ] **12.3 Verify** — manual against the fixture (click `task-spec` → `notes.md` opens at `#estimate`). Anchor logic already unit‑tested (Task 6).
- [ ] **12.4 Commit** — `feat(mindmap): read-only doc pane + anchor scroll`.

---

## Task 13 — ProjectView + open `.inkproj` wiring + file association

**Files:** Create `components/Mindmap/ProjectView.tsx`; modify `App.tsx`/`docActions`, the open‑file path, `electron-builder.yml`.

- [ ] **13.1** `ProjectView` — minimal split: `<Canvas/>` left, `<DocPane/>` right (resizable later; fixed/ratio for M1).
- [ ] **13.2** Opening: when the user opens a `*.inkproj` (file dialog filter + OS open‑file event), call `window.api.inkproj.open(path)` → `buildGraph` + `mergeLinkTypes` → `useProjectStore.setProject` → render `ProjectView` (a new app mode flag in the store; normal `.md` flow untouched). Close → `inkproj:close` cleanup.
- [ ] **13.3** `electron-builder.yml` — add a `.inkproj` `fileAssociation` (mirror the `.md` ones).
- [ ] **13.4 Verify** `npm run typecheck` + `npm run lint` + `npm run build`. Manual: open `sample.inkproj` → §9 Acceptance.
- [ ] **13.5 Commit** — `feat(mindmap): project-mode view + open .inkproj`.

---

## Task 14 — Acceptance + green gate

- [ ] **14.1** Run the full M1 acceptance (spec §9) against `sample.inkproj`: tree + typed cross‑link render; collapse/expand; click → doc opens; `{#id}` and `^id` anchors scroll; unknown keys don’t break.
- [ ] **14.2** `npx vitest run` (all green; pre‑existing `Editor.tab.test.tsx` jsdom error is a known non‑regression), `npm run typecheck`, `npm run lint`, `npm run build` — all clean.
- [ ] **14.3** Update `docs/mindmap/README.md` status → “M1 built”; note any deltas from the spec.
- [ ] **14.4** Finish the branch (superpowers:finishing‑a‑development‑branch) — present merge/PR/keep options to the user.

---

## Self‑review notes

- **Spec coverage:** Tasks map to spec §2–§9 (container read 7‑8, manifest/schema 2‑3, graph 4, layout 5, render 10‑11, doc+anchor 6/12, integration 13). ✓
- **Renderer‑agnostic boundary (D8):** all format/graph/layout logic is in `shared/mindmap` + `lib/mindmap`, imported by the React Flow components but not depending on them — the future Protocolist lib swaps in at the `Canvas` layer only. ✓
- **No save / no edit (D10 M1):** DocPane read‑only; no `inkproj:write`; working dir cleaned on close. ✓
- **Forward‑compat:** unknown `data`/manifest keys parsed and ignored (Tasks 2, 3, 10). ✓
