# Inkwell mind-map / project — consolidated backlog

> One place for everything parked-but-not-forgotten, pulled from our own specs
> (`our-vision §8`, M1–M6 plans) plus a survey of the reference apps
> (**Protocolist** `temp/ref/ai-protocolist-dev`, **AiOffice** `temp/ref/ai-office-*`)
> and **MindNode** (mindnode.com), the app the `.mindnode` format comes from.
>
> Each item: **source** · **effort** (S/M/L) · **priority** (★★★ near-term / ★★ soon / ★ later).

## North star & current strategy

The product goal is to **unite schemas (mind-maps) and markdown docs** into one tool.
Today the two halves are built **separately** — a mature **Markdown editor** and a
younger **schema editor** — and only *lightly* joined through the **`.inkproj` project**
(a schema + bundled `docs/` + `assets/`). **The project is the substrate** for the eventual
deep unification.

**Plan of attack:**
1. **Now → max out the schema editor + project workflow** (this doc's ★★★/★★ items).
   The markdown side is already strong; the schema side is where the leverage is.
2. **The first real bridge is an Outline view** (edit the schema as a markdown-ish outline
   and vice-versa) — it's the natural seam because our schema *is* a markdown outline.
3. **Then** converge md ⟷ schema at a high level on top of the project (multi-view / AST
   projections, node↔doc deep linking, shared navigation).

Keep every addition **additive to the `.mind-map`/`.inkproj` format** (D1) so interop holds.

## Already shipped (for reference)

M1 read-only render · M2a tree edit + Yjs + save · M2b cross-links + custom link types +
doc attach/edit · M2c node styling (color/shape/icons/tags) + anchors + reorder + external
docs · M3 New/Import/Export `.mind-map` · M4 standalone-HTML export · M5 multi-format import
(`.mind-map`/`.mind-doc`/`.mm`/OPML/MD/TXT/JSON + `.mindnode`) + image assets · M6 banded
multi-root layout + drop-ghost · per-node junction add-child/expand control.

---

## A. Schema editor — navigation & interaction  *(✅ mostly shipped in M7)*

- **✅ Node search + reveal** (M7-A) — `Ctrl+Shift+F`: filter nodes, auto-expand ancestors of a
  hit, center it, `N/M` counter, cycle matches. *Protocolist `search-panel.tsx`/`tree-nav.ts`; MindNode has it. · S*
- **✅ Keyboard navigation** (M7-B) — arrow keys move selection along the tree; `1–9` expand to
  depth N, `0` expands all; `Home` → root. *Protocolist `tree-nav.ts`; MindNode. · S*
- **✅ Multi-select + batch ops** (M7-C) — Shift/Cmd-click to build a selection; apply
  color/tag/delete to all. *Protocolist `keyboard-shortcuts.ts`. · M*
- **✅ Tag-highlight mode** (M7-D) — click a tag → highlight every node carrying it, dim the rest.
  *MindNode; Protocolist. · S–M*
- **✅ Focus mode on the canvas** (M7-D) — dim everything except the selected node + its branch
  (Focus button + `.`; Esc clears). *MindNode. · M*
- **★★ Quick Entry / capture** — a fast "add ideas" box (keyboard-first) that drops nodes
  into the current node/map without the mouse. *MindNode. · M*
- **★ Hotkeys help overlay** (`?`) + a fuller shortcut set; collapse/expand animations;
  auto-hide controls during drag. *Protocolist `hotkeys-help.tsx`. · S*
- **★ Breadcrumb of the selected node's path.** *Protocolist `tree-nav.navigate`. · S*

## B. Schema editor — nodes & visuals

- **★★ More node shapes** — cloud / hexagon / octagon / line / embedded (we have
  rounded/rectangle/pill/ellipse). *MindNode; Protocolist. · S*
- **★★ Interactive tasks** — toggle `taskStatus` by click; subtree progress rollup
  (we only render the badge today). *Protocolist `mind-node.tsx`; MindNode. · S–M*
- **★★ Frames / group brackets** — square/curved bracket / underline overlays that visually
  group a subtree (SVG over the band). *Protocolist `frames.tsx`. · S*
- **★ Short per-node note** (`data.note`) — a light annotation distinct from full attached
  docs; hover/expand to read. *MindNode "Notes"; Protocolist. · S*
- **★ Rich-text node labels** (bold/italic/font/size) — `labelHtml` already exists in the
  data model. *Protocolist `text-format-panel.tsx`; MindNode. · M*
- **★ Mind-map themes** — curated + custom node-color palettes, light/dark aware (separate
  from the app chrome theme). *MindNode; Protocolist. · M*
- **★ Layout direction options** — vertical / horizontal / compact, and left+right (radial)
  branch sides (we do right-growth banded). *MindNode; Protocolist `setSubtreeSide`. · M–L*

## C. Schema ⟷ Markdown bridge  *(the unification seam)*

- **★★★ Outline view** — edit the schema as an indented markdown-ish outline, switch
  mind-map ⟷ outline (or side-by-side), both driven by the same Yjs model. **The headline
  bridge feature** and the most natural one for an md-first app. *MindNode (core); MindDoc. · M*
- **★★ Node ↔ doc deep linking polish** — jump from an outline/doc heading to its node and
  back; surface a node's docs inline. Builds on anchors (D6). *ours. · M*
- **★ AST → projections (multi-view)** — one canonical model → mind-map / outline / table /
  slides projections; instant view switch, not export. Strategic for the converged product.
  *Protocolist MindDoc `MIND_DOC_ARCHITECTURE.md`, ADR-0033. · L*

## D. Import / export / interop

- **★★ Export OPML / Markdown / FreeMind `.mm`** — symmetry with our importers; `.mm` writer
  is a ~55-line port. *Protocolist `freemind-writer.ts`; MindNode exports all these. · S*
- **★★ Export PDF / PNG + Print** — Electron print-to-PDF and a canvas screenshot; print the
  map or the outline. *MindNode; Electron built-in. · S–M*
- **★ Rendered-markdown in the HTML export** — render doc bodies as HTML (sanitized) instead
  of `<pre>`, with inline images. *AiOffice `markdown-sanitize.ts` (rehype stack); our M4 backlog. · S*
- **★ Interactive HTML export** — embed the AST + a tiny renderer so the exported page folds
  branches in the browser (upgrade of the static export). *Protocolist ADR-0033. · M*
- **★ `.mindnode` writer (export)** — round-trip back to MindNode (binary protobuf).
  *Protocolist `mindnode-v2-writer.ts`. · L (niche)*
- **★ `.xmind` (real XMind ZIP, not legacy `.mm`)** import. *ours. · M*
- **★ Import *into* an open project** (merge a map under a node) vs always new. *ours. · M*
- **★ Subtitle / two-tier node text** on import — keep MindNode's title/subtitle instead of
  flattening multi-line titles. *Protocolist `MINDNODE_CONTENT_TYPES.md`. · S*

## E. Project format, persistence & resilience

- **★★ Autosave for project tabs** — debounced save like the md editor (project save is
  explicit-only today). *ours (M2a deferred). · S–M*
- **★★ Save-resilience** — autosave retry w/ backoff + a **shrink-guard** (refuse to persist
  a catastrophic node-count drop) + no silent failures. *Protocolist ADR-0052. · M*
- **★ Project-level instructions/notes in `manifest.json`** — per-project notes / schema
  rules / templates surfaced on open. *AiOffice project-instructions pattern. · S*
- **★ Project history / versions** — snapshots + restore (reuse the md editor's version
  infra). *AiOffice workflow tables; ours. · M*
- **★ Orphaned-doc GC** — on save, drop `docs/` files no node references (detach leaves them
  today). *ours (M2b deferred). · S*
- **★ Cross-`.inkproj` links** — `data.links[].file` links a node to a node in another
  project file. *ours (D4 reserved). · M*
- **★ Untitled "New project"** without an up-front path (save-as on first save). *ours. · S*
- **★ Canvas image thumbnails** — show a node's attached image on the canvas (needs an
  in-bundle file protocol / IPC, since the renderer can't read the working dir directly).
  *ours (M5-C deferred); MindNode. · M*

## F. Collaboration & AI  *(large / strategic — later)*

- **★ Multiplayer** — a networking provider over the local Yjs doc (P2P / self-hosted, never
  a cloud relay). Yjs model is already in place (D9). *ours; Protocolist yjs-relay; MindNode live-collab. · L*
- **★ Peer presence** — remote cursors + selection boxes via Yjs awareness. *Protocolist `peer-presence.tsx`. · M (needs multiplayer)*
- **★ AI assist** — command bar ("merge similar branches", "rename root"), expand/brainstorm
  a node, mind-map → article, summarize. Needs an LLM integration. *Protocolist `ai-command-bar.tsx`; MindNode on-device AI. · M–L*
- **★ Edit-history panel** with diff + rollback. *Protocolist `collab-history-panel.tsx`. · L (backend-ish)*

## G. Performance

- **★ Large-map virtualization** — beyond `onlyRenderVisibleElements` + collapse. *ours; Protocolist auto-collapse >2000 nodes. · M*
- **★ ELK auto-layout** as an alternative engine for huge/auto-arranged maps (we have the
  banded layout). *Protocolist `layout-elk.ts`. · L*

---

## Recommended next (a coherent slice)

A near-term milestone that maxes the schema editor before the big convergence:

1. **Node search + reveal** (A) — biggest pain on imported maps.
2. **Keyboard navigation + multi-select & batch** (A).
3. **Tag-highlight + focus mode** (A).
4. **Export OPML / Markdown / FreeMind / PDF + Print** (D) — quick interop wins.

Then the **Outline view** (C) as the first real schema⟷markdown bridge milestone, on top of
the project.

## Skip (not for us)

iCloud / Apple Reminders / Vision Pro / Apple Shortcuts (Apple-specific); MindNode's
proprietary sticker pack; AiOffice's GDrive-mirror, multi-agent orchestration, and
meeting/transcription pipeline (business-shell concerns, not editor features).
