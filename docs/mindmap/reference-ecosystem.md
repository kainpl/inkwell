# Reference ecosystem — how the source works *now*

> What we are porting. This is the accumulated analysis of the **AiOffice / AI‑Протоколист (MindSuite)** codebases — the thing whose mind‑map editor + file format we want to bring into Inkwell. Source repos live (read‑only, gitignored) under `temp/ref/`. Captured 2026‑06‑02.
>
> **Legend:** ✅ shipped in code · 📄 documented / designed, **not** built · 🔬 reverse‑engineered.

---

## 0. The three reference repos

| Folder (`temp/ref/`) | What it is | Has the mind‑map? |
| --- | --- | --- |
| `ai-office-main` | AiOffice, **main** branch — desktop wrapper over Claude Agent SDK | ❌ only a 19‑line skill stub emitting Mermaid |
| `ai-office-dev` | AiOffice, **dev** branch — same app + MindSuite **integration** + design docs | ❌ MindManager “not started” here; only consumes Protocolist + docs |
| `ai-protocolist-dev` | **AI Протоколист** — the actual product that *implements* the live mind‑map editor + the `.mind-map` format | ✅ **this is the real implementation** |

So: the editor and the format we care about are **entirely in `ai-protocolist-dev`**. AiOffice is the business shell that *would* embed a mind‑map view (`MindManager`) but hasn't yet.

---

## 1. The big picture (AiOffice / MindSuite)

- **AiOffice** = Electron + Next.js desktop app that turns “chat with Claude” into “run an AI company”: a tree of AI agents by department, chat in the context of a project folder, Context Panel (instructions / files / memory / workflows). Data in three layers: a static agent catalog in code, live structure + connections in SQLite (`project_bindings` self‑FK tree + `agent_assignments` junction), and Google Drive as the real documents.
- The dev branch grew toward an **“AI Work OS”**: one node graph viewed through **7 management lenses** (`MgmtType`: Mind / Project / Process / Task / Communication / Document / AI). **Mind‑map is one of those lenses.**
- **MindSuite** product family (all separate SaaS siblings sharing the `mind-doc.pro` backend):
  - **AI Protocolist** ✅ — meeting transcript → structured protocol + tasks.
  - **MindStenographist** ✅ (v2) — builds a **live mind‑map while a meeting runs** (Recall.ai bot → Deepgram STT → LLM outline). “Exactly one main node” is a hard invariant.
  - **MindManager** 📄 — a mind‑map **view over `project_bindings`**, browser **Canvas**; “not started” inside AiOffice (the editor it would reuse is the Protocolist one).
  - **MindDoc** 📄 — the **file format** (see §6).
- **Polysystem invariant** (their coupling we explicitly want to drop): creating a node anywhere fans out to *GDrive folder == Telegram topic == Trello board*. One tree, mirrored across tools.

---

## 2. The live mind‑map editor (✅ `ai-protocolist-dev`)

**Stack:** Next.js 15 · **React Flow (`@xyflow/react`)** for the canvas · **ELK** (`rf/layout-elk.ts`, ~1.3k lines, lazy) as the real layout engine, **d3‑hierarchy** only a tidy‑tree fallback · **Yjs + Hocuspocus** over WebSocket for realtime collab · TanStack Query. `@dnd-kit` is **not** used on the canvas (only the dashboard file list).

Entry: `mind-map-engine.tsx` (55‑line wrapper, `dynamic(ssr:false)`) → `rf/rf-mind-map.tsx` (**6.2k‑line monolith** with every handler) → node renderer `rf/mind-node.tsx` (2k lines).

### Interaction model — the important part
- **No free‑form edge drawing.** `nodesConnectable={false}`. Edges exist **only** as parent→child tree relations (edge types `step` for tree, `crosslink` for the special MindNode “personal‑touch” arrows). Handles are invisible anchors.
- **Create nodes** via toolbar/keyboard, never by dragging an edge: `addChildTo`, `addSiblingTo / Before`, `addRootNode`, `insertParentOf`, `detachToRootOf` (`rf/tree-ops.ts`). Inline editor: `Enter` commits, `Tab` makes a child.
- **Structure changes happen by drag‑reparent** — the headline gesture:
  - Rigid subtree drag (node + all descendants move together, throttled to one update per rAF).
  - **Magnetism**: nearest valid parent detected by bbox proximity; a **phantom dashed “slot ghost”** shows where it will land; drop modes `child | before | after` (reparent vs sibling‑reorder).
  - **Snap‑back vs pin**: released near the auto‑slot → snaps back; released far → keeps a **manual position stored as a *delta* `offsetX/offsetY`** (not absolute). `Alt/Option` = magnetism off (pin exactly, no reparent).
- **Collapse/expand** per node (`data.expand === false` ⇒ collapsed); auto‑collapse for >2000‑node maps.
- **Multiselect**: Shift/Meta/Ctrl + rubber‑band; group drag/reparent/resize are multiselect‑aware.
- **Inline rich‑text edit**: double‑click → `contentEditable`; `Cmd+B/I/U`, strikethrough; HTML sanitized to a `<b><i><u><s><br><span style>` whitelist, stored as `data.labelHtml`. Two‑tier titles via `data.subtitle`.
- **Keyboard**: zoom (`Cmd +/-/0`), **structured AI corrections** (`Cmd+↑` merge‑up, `Cmd+→` split‑right → POST `/mind-map/corrections`, a training feedback loop), task toggle (`Cmd+T`), image attach (`Cmd+Shift+V`), reset position, undo/redo.

### State
- Zustand `useMindMapStore` (`rf/store.ts`): `nodes`, `edges`, + in‑memory undo/redo (deep‑cloned snapshots, limit 100). `setGraph(nodes, edges, pushHistory)` is the core write.
- `MindMapCtx` carries a reference‑stable bag of ~60 action callbacks; **transient per‑node UI state** (`_isEditing`, `_isSelected`, `_dropMode`, …) is injected into each node’s data via a parent `useMemo` so `React.memo` survives selection churn (perf for 300+ nodes).
- RF transform: `rf/mindmap-to-rf.ts` flattens the outline tree → RF nodes/edges (`outlineToRf`) and back (`rfToOutline`).

### Collaboration (Yjs)
- Transport: `@hocuspocus/provider` over WS (`apps/yjs-relay/`). A separate NestJS Socket.IO gateway feeds AI/live‑transcript outline updates into the same room.
- CRDT doc (schemaVersion 2): `Y.Map("nodes")`, `Y.Map("edges")`, `Y.Map("meta")`. Per‑node data is **split into 3 keys** — `label`, `posJson` (pins only), `dataJson` (rest) — a deliberate fix after a single‑blob design blew the relay heap to 1.5 GB while typing on a 537‑node map. Edges carry an explicit `order` for stable sibling order.
- **Y.Doc is authoritative**; relay flushes to Drive (~30 s debounce). Awareness = ephemeral cursors/selection/drag. Undo is origin‑scoped (your edits vs peers’).

---

## 3. Node data model — the `data` bag (✅)

The serialized node is intentionally loose: `interface MarkdownNode { name: string; children?: MarkdownNode[]; data?: Record<string, any> }`. There is **no canonical interface** — the field set is defined by consumers, and the serializer dumps the whole bag losslessly. Full field inventory observed in the editor (`rf/mind-node.tsx`, `rf/style-ops.ts`, etc.):

- **Identity/structure:** `nodeId`, `sourceId` (MindNode import), `layoutDirection` (RIGHT/DOWN), `branchType` (`default|smoothstep|step` edge curve), `tier` (`etalon|buffer` approve/reject), `mindnodeSide`, `_crosslinks`.
- **Text:** `labelHtml` (sanitized rich text), `subtitle`, `subtitleFontSize/Color`, `note`.
- **Typography:** `color`, `fontSize`, `fontWeight`, `fontStyle`, `fontFamily`, `textAlign`.
- **Shape/fill/border:** `shape` (`roundedRectangle|pill|diamond|…`), `fillColor`, `lineColor`, `borderColor`, `borderStyle` (`none|solid|dotted|animated`), `borderWidth`.
- **Size/position:** `userWidth/userHeight`; **`offsetX/offsetY`** (delta‑from‑auto‑slot pin, current model); `customLeft/customTop` (legacy absolute pin, from MindNode import).
- **Tags/icons:** `tag[]` (status chips), `icon[]` (emoji), `frame` (group container), `expand`.
- **Tasks:** `task`, `taskStatus` (`open|done|cancelled`), `taskType` (`bug|action|confirmed|rejected|warning`, derived from emoji prefix), `taskId`, `ownerUserId/ownerName`.
- **Locks/AI:** `lockLevel` (`hard` 🔒 = AI never edits / `soft` ⚠️ = AI suggests), `userLocked`, `pendingSuggestion`.
- **Image attachments:** `imageId` (server frame), `imageStatus`, `imageCaption`, `imageUrl` (inline data‑URL from MindNode import), `imageWidth/Name/Unavailable`.
- **Cross‑map links:** **`_externalLinks: { targetMapId, targetNodeId, targetNodeText? }[]`** → 🔗 badge; click deep‑links into the other map (`/mind-map?id=…&node=…`).

> **Note for us:** there is **no generic “attach arbitrary .md/PDF to a node”** field today. Attachments = images (`imageId`/`imageUrl`) + cross‑map **node references** (`_externalLinks`). Our “attach .md docs to nodes” is new ground (the closest precedent is `_externalLinks`, but that references a node in another *map*, not a document in a bundle).

---

## 4. The file format — `.mind-map` (✅ shipped; ADR‑0017)

The format the editor actually reads/writes. Reference impl: **`libs/shared/src/mind-map-markdown.ts`** (`outlineToMarkdown` / `markdownToOutline`).

**One map = one Markdown file.** Layout:
- YAML frontmatter: `title`, `createdAt`, `formatSpec` (a public URL stamped into every file so an LLM reading it knows the editing rules).
- `# Title` (H1).
- A **nested bullet list** = the tree (2‑space indent per level).
- Each node carries its lossless `data` bag in a **trailing HTML comment**: `- Node text <!-- mindmap {"nodeId":"a1","color":"#4af",…} -->`.
- Renders as **clean Markdown in Obsidian / GitHub / Notion** — the HTML comments are invisible there; the app re‑hydrates the data on read.

**Implicit‑root contract:** if the outline has a single root whose name equals the title, the H1 *is* the root and bullets are its children; the root’s data hoists to inline meta on the H1 line (`# Root <!-- mindmap {…} -->`).

**Round‑trip robustness:** empty‑named nodes preserved via a zero‑width‑space sentinel; in‑name newlines escaped to `U+0001`; literal `-->` inside JSON escaped so the lazy comment parser can’t be fooled.

**Extensions:** `.mind-map` is the primary write extension; `.mind-doc` is read‑only legacy (auto‑renamed on first save).

**Lossless JSON companion** (`.mindmap.json`, the “authoritative” form): `{ schemaVersion: 1, title, createdAt, updatedAt, outline: MarkdownNode[], meta }`. Legacy pair (`.md` structure‑only + `.mindmap.json`) is still readable but no longer written.

### Minimal example
```markdown
---
title: Q3 Planning
createdAt: 2026-05-13T10:00:00.000Z
formatSpec: https://mind-doc.pro/format
---

# Q3 Planning <!-- mindmap {"lineColor":"#abc"} -->

- УСЛУГИ <!-- mindmap {"nodeId":"a1","color":"#4af","startTimestamp":"2026-05-13T10:02:11Z"} -->
  - Б2Б <!-- mindmap {"nodeId":"b2"} -->
- ЗАДАЧИ
  - Подготовить смету <!-- mindmap {"task":true,"taskStatus":"open"} -->
```

### Task metadata (`libs/shared/src/mind-map-task-metadata.ts`)
- `TaskType` = `bug | action | confirmed | rejected | warning`, encoded by **emoji prefix** in the node name (`🐞→bug 🔴→action ✅→confirmed ❌→rejected ❗→warning`); strict prefix‑match; derived into `data.taskType`. Emoji stays in the name so third‑party markdown readers still show it.
- Checkbox `taskStatus`: `[ ]` open · `[/]` in‑progress · `[x]` done · `[?]` blocked · `[-]` cancelled.

---

## 5. Backend persistence & export (✅ `ai-protocolist-dev`)

**Three concurrent representations** (NestJS + Postgres/MikroORM):
1. **`.mind-map` file on Google Drive / S3** — canonical at‑rest snapshot / export target.
2. **Y.Doc CRDT binary** in `mind_map_yjs_state.state` (bytea) — live store during collab editing.
3. **`outline` jsonb** in `mind_map_sessions.outline` — live tree while an AI session builds it.

> Drive is explicitly *“an export target, not the live store.”* There is **no “MindMap” DB entity** — a saved standalone map is just a Drive file.

**Hierarchy:** `Tenant → User → MindMapFolder(self‑referential tree, ACL) → MindMapSession(→ optional Protocol) → outline / Drive map`. Folders nest; sessions/maps are leaves. A “Living Project Map” can be generated from accumulated knowledge into a new `.mind-map`.

**History:** `MindMapHistory` = snapshot‑based (full outline jsonb per entry), structural‑diff dedup (skips position‑only changes), owner‑only rollback (writes snapshot back to Drive + wipes the relay Y.Doc so the 30 s flush can’t resurrect the old state).

**Export interop** (`apps/api/.../mind-map/utils/`):
- **FreeMind `.mm`** — plain XML, **not zipped**. Carries text + hierarchy + alternating left/right top‑level position only; **all `data` (colors/tasks/ids) dropped**. Target: XMind/MindMeister/Freeplane/draw.io.
- **MindNode `.mindnode`** 🔬 — **a ZIP package** (JSZip, `STORE`). Root files: `Metadata.json` + `Contents.data` (**binary protobuf**, reverse‑engineered; `MM_PROTOCOL_VERSION=1296` required, peer/doc UUIDs must match). Survives text + hierarchy + child ordering + **task state**; per‑node color deliberately omitted (broke MindNode’s decoder). Always rewritten from scratch. **`.mindnode` is a renamed ZIP + an `assets/` folder of images — the working precedent for our container idea.**

**Attachments / OCR:** `OcrFrame` rows link to a node via `mindMapNodeId`; a node’s `data.frameRefs[]` lists the OCR frames it relies on. Two‑phase linking: rough timestamp match at capture, LLM refinement at stabilize.

---

## 6. MindDoc — the *designed* format (📄 not built)

The grander format vision (docs only; `docs/mind/*`, ADR‑0011/0017/0033). Worth knowing because it’s where they reasoned about exactly our problem.

- **Model:** **AST = single source of truth**; the Markdown text and the visual mind‑map are **projections** regenerated from it (Mermaid/TiddlyWiki pattern). View family: `mindmap → outline (Mind‑Doc → Mind‑Protocol) → sheet → slides → book`.
- **Self‑contained delivery (ADR‑0033) = INLINE into one HTML, *not* a zip:** one `*.mind-doc.html` with `<script>` blocks for AST (`application/json`), Markdown projection (`text/markdown`, **plaintext, not base64**), and visual channel, plus an inlined **Markmap** renderer (~200–300 KB) and a `<noscript>` fallback. Binary assets base64 in a separate script. **Base64‑everything is called an anti‑pattern.**
- **Hybrid delivery:** standalone `.html` (desktop) **+** hosted mirror (`{domain}/{slug}`) — because **iOS Quick Look disables JS**, so on iPhone the file degrades to the hosted link. (This whole constraint is about *recipient delivery*, which we don’t care about for a desktop editor.)
- **Knowledge‑FS node types (ADR‑0011, proposed):** `strategy 🟥 / tactics 🟧 / operations 🟩 / context 🟦 / knowledge 🟪 / raw ⚪`, with horizons (12w/4w/1w…). YAML: `node-id`, `node-type`, `owner`, `links-up[]` (hierarchy), `links-related[]` (horizontal), `horizon`, `status`.
- **Bundling stance — directly relevant to us:**
  - **“One format per file. Multiple formats → a ZIP of clean files.”** This is the *one* place they bless a ZIP container — and it’s exactly our idea.
  - They **reject polyglot single‑files** (PDF+HTML in one file = malware vector) and double extensions (`.minddoc.html` reads as `txt.exe`).
  - Cross‑document story is **atomic files + transclusion / wiki‑links** (`[[depends_on:…]]`, `[[see:…]]`, `[[rel:uuid]]`) — references, **never a bundled blob**.
  - `.mindnode` (renamed ZIP + `assets/` + JSZip) is a **precedent they already parse**.
- **Status:** MindDoc as a product/format is **not started in code**; there’s an open business fork “new file format vs. just a Protocolist feature” (owner Александр). The fact‑check leans “feature.”

---

## 7. What this means for us (one‑paragraph takeaway)

The *implemented* asset worth porting is the **`.mind-map` markdown‑with‑per‑node‑HTML‑comment‑bags format** + the **React Flow tree‑edit interaction model** (reparent‑by‑drag + magnetism, no free edges, collapse, rich inline labels, the rich `data` bag). Everything around it — Drive/Telegram/Trello polysystem, multi‑tenant, Yjs relay, OCR/meeting pipeline, hosted‑mirror/iOS delivery — is coupling we drop. Their own design docs independently arrive at our exact conclusion for multi‑document storage: **a renamed ZIP holding clean files + an `assets/` folder**, not a polyglot single file. See [`our-vision.md`](our-vision.md) for how we adapt it.
