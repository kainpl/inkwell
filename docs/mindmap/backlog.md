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
- **✅ Quick Entry / capture** (M7-E) — a ⚡ Quick box: each Enter adds a named child under
  the selected node, keeps focus. *MindNode. · M*
- **✅ Hotkeys help overlay** (M7-E, `?`). Collapse/expand animations + auto-hide controls
  during drag are still open. *Protocolist `hotkeys-help.tsx`. · S*
- **✅ Breadcrumb of the selected node's path** (M7-E). *Protocolist `tree-nav.navigate`. · S*

## B. Schema editor — nodes & visuals

- **✅ More node shapes** (M9) — added cloud (border-radius) + hexagon/octagon (clip-path,
  two-layer outline) to rounded/rectangle/pill/ellipse. *line / embedded still open. · S*
- **✅ Interactive tasks** (M9) — click the node checkbox to cycle `taskStatus`
  (none → open → done → cancelled); strikethrough when closed. *subtree progress rollup still open. · S–M*
- **✅ Frames / group brackets** (M9) — `data.frame` (bracket / underline) draws a translucent
  frame around a node's visible subtree (collapse-aware bbox, ViewportPortal overlay). *Protocolist `frames.tsx`. · S*
- **✅ Short per-node note** (M10) — `data.note`: a note textarea in the inspector + a 📝
  tooltip indicator on the node. *MindNode "Notes". · S*
- **✅ Rich-text node labels** (M10) — whole-label **bold / italic / underline** flags
  (render-applied → rename-safe), B/I/U toggles in the inspector. *inline-range rich text + font/size still open. · M*
- **✅ Mind-map themes** (M10) — curated node palettes (sunset/forest/ocean/mono) applied by
  depth, + Clear; a toolbar picker. *custom palettes still open. *MindNode; Protocolist. · M*
- **✅ Layout direction options** (M11) — **horizontal (→)** + **vertical (↓)** banded growth
  (toolbar toggle; handles + tail adapt). *left+right radial branch sides still open. *MindNode; Protocolist `setSubtreeSide`. · M–L*

## C. Schema ⟷ Markdown bridge  *(the unification seam)*

> **Architecture decided (2026-06):** the **tree is the core / SSOT**; markdown docs simply
> **attach to nodes, many-to-many** (one doc on N nodes, one node with N docs). There is **no
> canonical-AST rebuild** and **no `#heading ⇄ node` merge** — the MindDoc-style single-AST
> vision is *not* our direction. The current model (node `DocRef[]` + the views below) already
> realises this.

- **✅ Outline view** (M8) — edit the schema as an indented outline; Map/Outline/Split over the
  same Yjs model (rename, Enter/Tab/Shift+Tab/Backspace, ↑/↓). *MindNode (core). · M*
- **✅ Node ↔ doc deep linking polish** (M10) — outline 📄 opens a node's doc; a ⌖ chip in
  the doc bar reveals the open doc's node on the map (expand ancestors + select + center).
  *Builds on anchors (D6). *ours. · M*
- **✅ Many-to-many node ↔ doc links** (M12) — link an existing bundle doc to another node
  (**Link…**), an **🔗 also:** row of the nodes sharing the open doc, and a **Docs** panel
  (all docs + referencing nodes). *ours. · M*
- **✅ Multi-view projections of the tree** — map / outline / **table** (M11) are live
  projections of the one model (instant switch, not export). *slides projection still open;
  a canonical-AST rebuild is **explicitly not pursued** (see the note above). · S each*

## D. Import / export / interop

- **✅ Export OPML / Markdown / FreeMind `.mm`** (M9) — pure generators (`exportFormats.ts`),
  each re-importable through its parser; File → Export Schema as ▸. *MindNode exports all these. · S*
- **✅ Export PDF / PNG + Print** (M10) — the project HTML → PDF (printToPDF), PNG (capturePage),
  and an in-app print preview, reusing the markdown editor's export IPC. *MindNode; Electron built-in. · S–M*
- **✅ Rendered-markdown in the HTML export** (M10) — doc bodies render as sanitized `.ink-doc`
  HTML (via `renderMarkdownBody`) with inlined images, instead of `<pre>`. *AiOffice `markdown-sanitize.ts`. · S*
- **★ Interactive HTML export** — embed the AST + a tiny renderer so the exported page folds
  branches in the browser (upgrade of the static export). *Protocolist ADR-0033. · M*
- **★ `.mindnode` writer (export)** — round-trip back to MindNode (binary protobuf).
  *Protocolist `mindnode-v2-writer.ts`. · L (niche)*
- **★ `.xmind` (real XMind ZIP, not legacy `.mm`)** import. *ours. · M*
- **★ Import *into* an open project** (merge a map under a node) vs always new. *ours. · M*
- **★ Subtitle / two-tier node text** on import — keep MindNode's title/subtitle instead of
  flattening multi-line titles. *Protocolist `MINDNODE_CONTENT_TYPES.md`. · S*

## E. Project format, persistence & resilience

- **✅ Autosave for project tabs** (M11) — debounced save like the md editor, gated on the
  global autoSave flag + the active dirty project tab. *ours (M2a deferred). · S–M*
- **◐ Save-resilience** (M11) — a **shrink-guard** skips an autosave that would overwrite a
  non-trivial map with a stub. *retry-with-backoff + surfaced failures still open. *Protocolist ADR-0052. · M*
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

- **◐ Large-map virtualization** (M11) — `onlyRenderVisibleElements` enabled (+ collapse).
  *auto-collapse beyond N nodes still open. *ours; Protocolist auto-collapse >2000 nodes. · M*
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
