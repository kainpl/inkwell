# Our vision — what we build & how

> Inkwell’s new architectural layer: a **schema/mind‑map editor** that lives inside the markdown editor, backed by a **single self‑contained project file** (a custom‑extension ZIP). Decoupled from the source ecosystem’s cloud machinery. **Status: draft — to discuss/refine, not yet a spec.** Date 2026‑06‑02, branch `feat/mindmap`.
>
> Counterpart: [`reference-ecosystem.md`](reference-ecosystem.md) (how the source works now).

---

## 1. The idea (user’s words, restated)

> Cut ourselves loose from Google Drive / Protocolist / all that machinery. One file with a custom extension; inside it’s a **ZIP** containing the **schema** (all branches/sub‑branches with their connections) plus **auxiliary files** (the `.md` docs and more) laid out in a folder structure. You open such a file → Inkwell switches into a **new mode** where you edit the schema (or start a project from scratch) and **attach other `.md` files** — pulled in from various folders/subfolders — to nodes of the schema. Inkwell becomes **2‑in‑1: a markdown editor *and* a schema editor over a bundled project.**

Confirmed correct. This is essentially a **“project‑in‑a‑file”** like `.docx` / `.epub` / Krita `.kra` / Scratch `.sb3` / Obsidian `.canvas` — and the source ecosystem already parses exactly this shape (`.mindnode` = renamed ZIP + `assets/`), so we’re on a trodden path.

## 1a. Guiding principle — inherit & interoperate (not fork)

We **inherit their base format and extend it additively**. The relationship is two‑way: we should be able to read their `.mind-map` files, they should be able to read ours (at least the schema), and either side can adopt the other’s ideas. So:
- **Stay read‑compatible with `.mind-map`.** Their `data` bag is open‑ended and lossless — perfect for extension. New features = **new optional keys** in `data` + **new files** in the ZIP they can ignore, never breaking changes to existing keys/structure.
- A bare `.mind-map` is just our `schema.mind-map` without the ZIP wrapper → both directions degrade gracefully.
- Diverge only when a feature genuinely can’t be expressed additively — and even then, behind an ignorable extension + a version flag.

---

## 2. The container format (working sketch)

A single file, custom extension (placeholder **`.inkproj`** / `.iwm` — name TBD), internally a ZIP (store/deflate). Proposed layout:

```
project.inkproj                     (ZIP)
├── manifest.json                   format version, app version, ids, settings
├── schema.mind-map                 the mind‑map (markdown + per‑node <!-- … --> bags)
│                                   ⟵ adopt the source's .mind-map format verbatim-ish
├── docs/                           bundled markdown documents (the "md‑шки")
│   ├── intro.md
│   ├── research/
│   │   └── notes.md
│   └── …                           arbitrary folder/subfolder structure
├── assets/                         images & binaries referenced by docs/nodes
│   └── diagram.png
└── .history/ (optional)            snapshots for undo across sessions
```

Key decisions baked into this sketch (all open to change — see §6):
- **The schema is its own entry** (`schema.mind-map`), reusing the source’s human‑readable markdown‑with‑node‑bags so the schema is still grokkable if unzipped. (Alternative: a `schema.json` lossless form, or both.)
- **Node identity:** every node carries a stable `id` in its `data` bag — cross‑links and doc refs resolve to it.
- **Node ↔ docs (maximal):** a node references `0..N` docs via `data.docs: [{ path: "docs/notes.md", anchor?: "#id", title? }]`; the same doc may be referenced by many nodes; an anchor may target a section *inside* a doc. (New capability — the source links node→node across maps, never node→document.)
- **Cross‑links:** typed edges between any two nodes (across branches/levels), additive on top of the tree — see D2/§6.
- **Everything is local & relative** — no Drive ids, no tenant ids, no external URLs. Move/rename the file freely; it stays whole.
- **One open file = one project = one editor session.** Dirty/save semantics operate on the whole bundle (write a new ZIP atomically on save; keep a temp working dir while open).

---

## 3. Inkwell integration

- **New “schema” view** alongside the markdown editor. Opening a `.inkproj` switches Inkwell into project mode: a **canvas** (mind‑map) on one side, and the attached `.md` opening in the normal CodeMirror editor when you click a node. A node that has a doc behaves like a tab/file; a node without one is just a schema node.
- **Two creation paths:** open an existing project file, **or** “New project” → start an empty schema from scratch and grow it.
- **Attach docs:** drag a `.md` (from anywhere) onto a node → it’s copied into `docs/…` in the bundle and linked; or create a new doc straight from a node.
- Reuse what Inkwell already has: CodeMirror for the markdown side, the Mermaid renderer (diagrams *inside* docs stay as‑is), Electron file‑association + custom extension (we already register `.md`/`.markdown`/… — add the project extension), the existing tab model.
- **Canvas engine — open choice:** React Flow (`@xyflow/react`, what the source uses — proven, but a heavy dep + their own files note tree‑layout pain) vs a lean custom CodeMirror/SVG/Canvas renderer tuned for our tree‑only model. Decide during design.

---

## 4. What we TAKE (port / adapt)

- **The `.mind-map` text format** — markdown + `# Title` + nested bullets + per‑node `<!-- mindmap {…} -->` lossless `data` bag. Self‑documenting, diff‑friendly, opens in any markdown tool. Reference impl `libs/shared/src/mind-map-markdown.ts` is small and clean — port `outlineToMarkdown` / `markdownToOutline` (incl. implicit‑root contract + round‑trip sentinels).
- **The node `data` model** — positions as deltas (`offsetX/offsetY`), colors (`lineColor`/`fillColor`/`color`), `shape`, rich `labelHtml`, `tag[]`/`icon[]`, `expand`, tasks (`task`/`taskStatus`/`taskType` via emoji prefix). Take the useful subset; drop server‑coupled fields (`imageId` server frames, `frameRefs`, `tier`, AI‑lock workflow).
- **The tree‑edit interaction model** — create via toolbar/keyboard; **reparent‑by‑drag with magnetism + phantom slot ghost**; collapse/expand per node; multiselect; inline rich‑text edit. This UX is the source’s real value.
- **Task metadata convention** — emoji‑prefix → `taskType`, `[ ]/[/]/[x]/[?]/[-]` checkbox states.

## 5. What we DROP

- Google Drive / S3 storage, the “Drive is canonical” model → replaced by the local ZIP bundle.
- **Polysystem** (node == GDrive folder == Telegram topic == Trello board), Telegram, Trello.
- Multi‑tenant, JWT/OAuth, ACL, sharing — single‑user local files.
- **Yjs/Hocuspocus realtime collab** — out for v1 (a local file is single‑writer). Keep the door open: a CRDT‑per‑document layer could come later, but it isn’t a v1 concern.
- OCR / Recall meeting pipeline, live‑transcript outline building, AI corrections backend.
- Hosted‑mirror + `.mind-doc.html` self‑contained‑HTML + iOS delivery — that whole concern is about *sending a read‑only artifact to a recipient*; irrelevant for an editor working file. (We can still add an **export to standalone HTML** later as a one‑way share, like FreeMind/MindNode export.)

## 6. Decisions locked (2026‑06‑02)

- **D1 — Schema format.** `schema.mind-map` (their markdown + per‑node `<!-- mindmap {} -->` bags) is canonical. Extend **additively**: new per‑node/tree data = new keys in the `data` bag (parser‑free; their reader ignores them); document‑level data = frontmatter; **heavy non‑tree structures = ignorable sidecar files** in the ZIP. *(was Q1=A, Q3=A)*
- **D2 — Edges.** A spanning **tree** (parent→child, auto‑laid‑out) **+ typed cross‑links** as first‑class edges: any node → any node, across branches/levels. *(was Q2=B)*
- **D3 — Node ↔ docs (maximal).** A node references **0..N** docs; a doc may be referenced by **N** nodes; a reference targets the **whole doc OR a specific anchor** inside it; docs are bundled under `docs/`. Cover every variant a user might want. *(supersedes Q4/Q5)*
- **Node identity.** Every node carries a **stable `id`** (uuid/short‑id in the `data` bag) — required for cross‑links and doc refs to resolve.
- **D4 — Cross‑link storage (two‑tier).** Portable core on the **source node**: `data.links: [{ id, to, type, label?, file? }]` — canonical, round‑trips through `.mind-map` (their reader ignores but preserves it). A **generated sidecar** (`graph.json` / project `index.json`) adds (a) a derived adjacency / reverse‑link index for fast render at scale and (b) our‑only edge enrichment keyed by edge `id` (routing, styling, layers, metrics). **Invariant:** the *set* of edges is owned by `data.links`; the sidecar only indexes/annotates, never declares an edge, and is rebuildable from canonical. Each edge carries a stable `id`; `file?` is reserved for future cross‑`.inkproj` links. *(A+B)*
- **D5 — Link types.** Curated base set + **first‑class custom types**: `relates‑to / depends‑on / references / blocks / duplicates / see‑also` (aligned to MindDoc `rel / depends_on / see` for interop) plus user‑defined. An edge’s `type` is a string key; the **type registry** (label, color, icon, arrowhead, default directionality) lives in `manifest.json` — built‑ins have app defaults, overrides + custom types persist there as first‑class. Their reader round‑trips the type string; the visual registry is our sidecar (ignored by them). Directed: depends‑on/blocks/references; symmetric: relates‑to/see‑also; an edge may override. *(A + first‑class custom)*
- **D6 — Anchors.** A doc reference’s `anchor` is always an **explicit stable id** (`docs/x.md#id`), never a text‑derived slug (slugs break on rename → soft navigation fallback only). **Both id sources in scope from v1:** `{#id}` on headings (Inkwell already supports) **and** block‑ids `^id` on any line/block (Obsidian‑style, new feature). Lets a node point at any spot in a doc. *(D — both, immediate)*
- **D7 — Attached docs.** Both modes, per‑doc choice. **Default = copy‑in** to `docs/` (project‑relative path, fully portable). **Option = external reference** (`{ external: true, src }`) to avoid bloating the bundle with huge md repos. Missing external → “missing → relink”; one‑click **internalize** copies an external doc into the bundle. `data.docs[]` holds either an internal `path` (in ZIP) or `external + src`. **Security:** a project file is untrusted input, so the main process **never reads a manifest-supplied `external` `src`** (arbitrary file read) — external docs are opened only through a user-driven OS file picker; bundle reads are gated to known working dirs + symlink-safe path resolution. *(B — copy default + external w/ internalize)*
- **D8 — Canvas engine.** **React Flow (`@xyflow/react`)**, renderer kept a **swappable layer** (format D1–D7 is engine‑agnostic → replaceable with a custom Canvas later if giant‑scale perf demands). **Plan:** build on raw `@xyflow/react` now; when the Protocolist team ships a **packaged mind‑map library over `@xyflow/react`**, adopt it as a layer on top and contribute features upstream (two‑way). Cross‑links use React Flow’s native edge‑drawing (source disabled it for tree‑only); tree edges stay auto‑laid‑out. *(A — swappable; adopt their lib when it lands)*
- **D9 — Collaboration.** No multiplayer in v1 (zero server/network — stays decoupled). **But** the in‑memory editing model is a **local Yjs doc from v1** (the adopted lib is Yjs‑bridged → free undo/redo via Y.UndoManager + a clean path to add networking later). Networking, when added, uses a **decoupled transport** (P2P / self‑hosted), never their cloud relay. *(A functionally + Yjs model local from v1)*
- **D10 — v1 scope.** **Milestone 1 = A (read‑only)** — the end‑to‑end vertical slice (ZIP → parse `.mind-map` → build graph → React Flow render of tree + cross‑links → click node → resolve doc ref → open in CodeMirror + scroll to anchor); already useful (open/navigate/read a project). **Milestone 2 = B (edit + save)** — create/rename/reparent nodes, draw cross‑links, attach docs, write ZIP. **C (full parity) is not a goal** — grow incrementally (their lib slots in). Format completeness (D1–D7) is independent of editor scope. *(A → B)*
- **D11 — Import/export.** v1 = **`.mind-map` round‑trip** (import standalone `.mind-map` → new `.inkproj`; export project schema → standalone `.mind-map`) — near‑free (we build the parser/serializer anyway) and the core of two‑way interop. `.mindnode` / FreeMind import/export **parked → Backlog** (revisit when the Protocolist lib lands — it carries those readers). *(A; B backlogged, not buried)*
- **D12 — Save model.** **Unpacked working directory** (extracted under `userData` on open) + **zip‑on‑Save/Close** (atomic temp‑then‑rename for the final bundle write). Autosave writes individual files into the working dir (fast, incremental — scales to giant bundles); CodeMirror saves the open `.md` straight there; the Yjs schema model flushes to `schema.mind-map` there. **Crash recovery:** an orphaned working dir is detected on next open and offered for recovery (reuse Inkwell’s draft‑recovery infra). *(B — working dir + zip on Save/Close)*
- **D13 — Format name.** Project file extension = **`.inkproj`** (a project container: schema + bundled docs/assets). Cosmetic — registered via Electron file‑association + named in `manifest.json`; changeable later if ever needed. *(settled: `.inkproj`)*

## 7. Open questions (next round)

*All round‑2 questions answered — see §6 Decisions (D1–D13). New questions will be filed here as the v1 spec is drafted.*

---

## 8. Backlog — parked, not forgotten

- **`.mindnode` / FreeMind import + export** — source has the readers (2.5k‑line MindNode protobuf parser) + writers; revisit when the Protocolist lib lands (it carries them). [D11]
- **Cross‑`.inkproj` links** — `data.links[].file` is reserved for linking a node in another project file. [D4]
- **Multiplayer** — a networking provider over the local Yjs model; decoupled transport (P2P / self‑hosted), never the cloud relay. The unpacked working‑dir model (D12) is sync‑friendly — individual files can update incrementally (e.g. over a file‑sync transport), pairing naturally with the CRDT path. (theory; not v1.) [D9, D12]
- **Export to standalone HTML** — MindDoc‑style shareable read‑only artifact (one‑way), later.
- **AST‑canonical mode** — if our extensions outgrow `.mind-map`, optionally flip to a richer JSON/AST source‑of‑truth with `.mind-map` as a projection (MindDoc philosophy).
- **Editor parity** beyond M1/M2 — rich node styling, frames/groups, magnetism polish, large‑map virtualization.
- **External-doc open flow** — D7's external reference is read-blocked for security; build the user-driven file-picker grant (pick the file once, read only that) + the internalize action. [D7 security]

## 9. Next steps

1. Pull `ai-protocolist` for the editor + parser internals — **done** (`temp/ref/ai-protocolist-dev`).
2. ← **we are here**: align on vision (this doc) and answer §7 open questions together.
3. Brainstorm → design spec for v1 (container layout + schema format + the minimal editor) — likely via the brainstorming/writing‑plans flow, scoped to a thin vertical slice (open a hand‑authored `.inkproj`, render the tree, click a node → open its doc).
4. Implement on `feat/mindmap`.
