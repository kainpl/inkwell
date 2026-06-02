# Milestone 1 — spec (read‑only vertical slice)

> The first buildable slice of the schema/mind‑map layer. Derived from the locked decisions **D1–D13** in [`our-vision.md`](our-vision.md). Branch `feat/mindmap`. Status: spec for review.

## 1. Goal & scope

Prove the whole pipe end‑to‑end and ship something already useful: **open a `.inkproj`, see its schema, read its docs.**

**In scope (M1):**
- Register `.inkproj`; open it (file dialog + OS association).
- Extract the bundle to a working dir (D12), read `manifest.json` + `schema.mind-map`.
- Parse the schema → node/edge graph (tree from nesting + typed cross‑links).
- Render in a **React Flow** canvas: tree (auto‑laid‑out) + cross‑links (typed, colored), pan/zoom/minimap, collapse/expand for navigation.
- Click a node → open its primary attached doc in Inkwell’s CodeMirror; if the ref has an anchor, scroll to it (`{#id}` or `^id`).

**Out of scope (M1) — deferred to M2+/Backlog:**
- Any editing: create/rename/reparent nodes, draw cross‑links, attach docs, internalize.
- Saving / zip‑back (M1 never writes the bundle).
- Multiplayer networking (the Yjs model is created locally but read‑only here).
- Import of `.mindnode` / FreeMind; export.
- The generated sidecar index (`graph.json`) — M1 builds the adjacency index **in memory**; no sidecar written.
- Rich node‑style editing UI.

## 2. Container layout (`.inkproj`)

A ZIP (extension `.inkproj`, D13). M1 reads:

```
project.inkproj                  (ZIP, STORE/deflate)
├── manifest.json                project metadata + link-type registry
├── schema.mind-map              the schema (D1 format)
├── docs/                        bundled markdown docs (D3/D7)
│   ├── intro.md
│   └── research/notes.md
└── assets/                      images/binaries referenced by docs (read as needed)
```

`graph.json` (sidecar index, D4) is **not required** for M1 — we rebuild the index in memory on load. A bundle may already contain one (written by a later milestone); M1 ignores it.

## 3. `manifest.json` (M1 subset)

```jsonc
{
  "format": "inkproj",
  "formatVersion": 1,
  "app": "inkwell",
  "appVersion": "0.1.0",
  "title": "Q3 Planning",
  "createdAt": "2026-06-02T10:00:00.000Z",
  "updatedAt": "2026-06-02T10:05:00.000Z",
  "schema": "schema.mind-map",          // entry path inside the bundle
  "linkTypes": {                         // D5 — registry; built-ins overridable + custom
    "depends-on":  { "label": "depends on", "color": "#e0772b", "arrow": "to",   "directed": true },
    "relates-to":  { "label": "relates to", "color": "#7a8aa0", "arrow": "none", "directed": false },
    "my-custom":   { "label": "Blocks deploy", "color": "#c0392b", "arrow": "to", "directed": true, "icon": "🚧" }
  }
}
```

- M1 **reads** `title`, `schema`, and `linkTypes`. Built‑in link types have app defaults; `linkTypes` here only carries overrides + custom types (merged over defaults on load).
- Unknown manifest keys are ignored (forward‑compat).

## 4. `schema.mind-map` — the fields M1 reads (D1)

Format unchanged from the source (frontmatter + `# Title` + nested bullets + per‑node `<!-- mindmap {…} -->`). M1’s parser is a port of `markdownToOutline` (`temp/ref/ai-protocolist-dev/libs/shared/src/mind-map-markdown.ts`), producing `MarkdownNode { name, children?, data? }`.

`data` fields **consumed by M1** (everything else is parsed, kept, and ignored for render):

| Field | Used for |
| --- | --- |
| `id` | stable node id (D‑node‑identity). If missing, derive a deterministic id from path‑in‑tree so cross‑links/doc‑refs can still resolve within the session. |
| *(nesting)* | parent→child tree edges (implicit, from bullet indent). |
| `links: [{ id, to, type, label? }]` | typed cross‑link edges (D2/D4). `to` = target node `id`. `type` resolves against the manifest registry. |
| `docs: [{ path, anchor?, title?, external?, src? }]` | attached docs (D3/D7). M1 opens `docs[0]` on click. `path` = bundle‑relative (`docs/…`); or `external:true, src` for an on‑disk file. `anchor` = `#id`. |
| `label` / *(bullet text)* | node caption. |
| `labelHtml?` | sanitized rich caption (render with the same whitelist the source uses). |
| `color?` `lineColor?` `fillColor?` `shape?` `icon?` `tag?` | basic node styling (best‑effort render). |
| `task?` `taskStatus?` `taskType?` | checkbox/badge render (read‑only). |
| `expand?` | initial collapsed state (`expand === false` ⇒ collapsed). |
| `offsetX?/offsetY?`, `customLeft?/customTop?` | honored as manual pins **if present**; otherwise the node is auto‑laid‑out. |

### Example bundle `schema.mind-map`
```markdown
---
title: Q3 Planning
createdAt: 2026-06-02T10:00:00.000Z
formatSpec: https://mind-doc.pro/format
---

# Q3 Planning <!-- mindmap {"id":"root"} -->

- Services <!-- mindmap {"id":"svc","docs":[{"path":"docs/services.md"}]} -->
  - B2B <!-- mindmap {"id":"b2b","links":[{"id":"e1","to":"task-spec","type":"depends-on"}]} -->
- Tasks <!-- mindmap {"id":"tasks"} -->
  - Prepare estimate <!-- mindmap {"id":"task-spec","task":true,"taskStatus":"open","docs":[{"path":"docs/research/notes.md","anchor":"#estimate"}]} -->
```
(`b2b` cross‑links to `task-spec` with type `depends-on`; `task-spec` opens `notes.md` scrolled to the `#estimate` anchor.)

## 5. Read pipeline

```
open .inkproj
  → main: extract ZIP → working dir under userData/inkproj-work/<uuid>/   (D12)
  → main: read manifest.json + schema.mind-map  → IPC to renderer
  → renderer: markdownToOutline(schema)  → MarkdownNode tree
  → buildGraph(tree, manifest):
        nodes  = flatten tree (id, label, data, depth, parentId)
        treeEdges = parent→child
        crossEdges = every node.data.links[] → {id, source:node.id, target:link.to, type}
        index  = in-memory adjacency + reverse-link maps (D4, not persisted)
  → seed a local Yjs doc from the graph (D9 — read-only this milestone)
  → React Flow render (§6)
```

- ZIP extract + file reads happen in the **main process** (security: renderer never touches fs directly — consistent with Inkwell’s `window.api` rule). New IPC: `inkproj:open` (path → {manifest, schema, workingDir}), `inkproj:readDoc` (workingDir‑relative or external path → text).
- Working dir lifecycle: created on open, removed on close. (Crash‑recovery detection is an M2 concern; M1 just cleans up on normal close.)

## 6. React Flow render (M1)

- **Node type** `mind` — custom node: caption (`labelHtml`/`label`), optional icon/tag/task badge, collapse chevron when it has children. Basic styling from `color/fillColor/lineColor/shape`. `nodesDraggable=false`, `nodesConnectable=false` (read‑only).
- **Edge types**:
  - `tree` — parent→child, neutral, auto‑routed (`step`/smooth).
  - `crosslink` — typed; color/arrow/label from the manifest `linkTypes` registry; visually distinct from tree edges.
- **Layout**: `d3-hierarchy` tidy tree over the tree edges (port the source’s `rf/layout.ts` approach; ELK deferred). Honor manual pins (`offset*`/`custom*`) when present, else use computed positions. Cross‑links are drawn as overlay edges on top of the laid‑out tree (no effect on layout).
- **Interactions (read‑only)**: pan, zoom, fit, minimap, collapse/expand (cascaded subtree hide, like the source’s `filterCollapsed`), select‑to‑highlight a node and its incident cross‑links.
- **Perf**: `onlyRenderVisibleElements` + collapse keep the visible node count bounded; full‑graph virtualization is Backlog.

## 7. Node → doc → CodeMirror

- Click a node with `data.docs` → open `docs[0]` (multi‑doc picker is M2). 
  - internal: read `workingDir + path`; external: read `src` (D7).
  - Render in Inkwell’s existing CodeMirror, in a **doc pane** beside the canvas (project mode = canvas ⟷ editor split).
- **Anchor scroll** (D6): if the ref has `anchor: "#id"`, resolve in the opened doc:
  - heading `{#id}` — reuse Inkwell’s existing heading‑id parsing.
  - block `^id` — new resolver: find the line/block carrying a trailing `^id`, map to a CM position; scroll into view + briefly highlight.
  - no match → open doc at top + non‑blocking warning.
- M1 doc pane is **read‑only or normally‑editable but not saved back to the bundle** — decide in review (recommend: open normally in CM but M1 does not persist; saving is M2). Cleanest for M1: open **read‑only** to avoid implying persistence.

## 8. Inkwell integration

- **File association**: add `.inkproj` to electron‑builder `fileAssociations` + the open‑file handlers (mirror existing `.md` handling).
- **Project mode**: opening a `.inkproj` enters a split view (React Flow canvas + CodeMirror doc pane). Normal `.md` opening is unchanged. TabBar/Outline behavior in project mode — minimal in M1 (the canvas is the navigator).
- **New deps**: `@xyflow/react`, `d3-hierarchy`, a zip reader in main (`yauzl`/`adm-zip`/`jszip` — pick during build; jszip is simplest for read). Reuse CodeMirror + heading‑id logic.
- **Renderer‑agnostic boundary** (D8): the graph model + format live in a `lib/` module independent of React Flow, so the engine stays swappable and the future Protocolist lib can drop in.

## 9. Acceptance (M1 “done”)

1. Hand‑author a sample `project.inkproj` (script in `scripts/` to zip a fixture folder).
2. Open it in Inkwell → canvas shows the tree + at least one typed cross‑link (correct color/arrow from the registry).
3. Collapse/expand a subtree; pan/zoom/minimap work.
4. Click a node → its doc opens in CodeMirror; a node with `anchor` scrolls to the right heading (`{#id}`) and to a `^id` block.
5. Unknown future `data`/manifest keys don’t break rendering (forward‑compat).
6. `typecheck` / `lint` / existing tests stay green; new pure helpers (`markdownToOutline` port, `buildGraph`, anchor resolver) have unit tests.

## 10. Resolved (2026‑06‑02)

- **Doc pane** — **read‑only** in M1 (no save back to the bundle). Editing + save = M2.
- **Layout** — **honor pins (`offset*`/`custom*`) if present, else auto‑layout** (d3‑hierarchy).
- **Zip library** — **`jszip`** (read path).
- **Project‑mode UX** — **minimal split** (canvas + read‑only doc pane), no extra chrome.

---

*Next after sign‑off:* turn this into a task‑by‑task implementation plan (writing‑plans) and build on `feat/mindmap`.
