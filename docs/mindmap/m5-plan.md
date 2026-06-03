# Milestone 5 — plan + design (import hub + image assets)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes. **Status: plan for review** (scope/ordering to confirm before build).

**Goal:** Open/import many mind-map source formats into a new `.inkproj`, and embed images. Turns Inkwell into a real on-ramp for existing maps (FreeMind/Freeplane/XMind-legacy/MindMeister/Coggle/OPML/MindNode) plus our own `.mind-map`/`.mind-doc`.

**Architecture.** A **pure, per-format importer** maps each source → our `{ title, outline }` (MarkdownNode), then the existing path takes over: `outlineToMarkdown` → `createInkproj` (M3) → open. Text formats parse with the renderer's `DOMParser` (XML/OPML) — **adapted from the source's client importer** (`temp/ref/ai-protocolist-dev/apps/web/src/lib/mind-map-import.ts`, ours to inherit per §1a). Binary `.mindnode` (protobuf) is a separate, heavier phase. Image assets land in the bundle's `assets/` and embed (base64) in the HTML export. Decisions: [`our-vision.md`](our-vision.md) §1a interop, §8 backlog [D11].

**Conventions:** pure parsers unit-tested on fixtures; conversion in the **renderer** (needs `DOMParser`); main does file dialogs + `createInkproj`; commit per green group; one QA per phase-group.

---

## Phase A — multi-format text import (the core)

**Design.** `.mind-doc` is a **legacy alias** of `.mind-map` (same markdown+data format) — trivial. `.mm` covers the FreeMind family. Each parser returns `{ title, outline }`; `data` is filled opportunistically (colors/shape) when the source carries it.

**Files:** create `lib/mindmap/import/index.ts` (`importAny`) + per-format modules (`mindmap.ts`, `freemind.ts`, `opml.ts`, `indented.ts`, `json.ts`) + tests; modify `index.ts` (`inkproj:pickImportFile`, `inkproj:createFromImport`), `shared/ipc.ts`, `preload`, `projectActions.ts`, `menu.ts`, `i18n`, `App.tsx`.

- [ ] **A1** `importAny(name: string, text: string): { title: string; outline: MarkdownNode[] }` — dispatch by extension/content. Unknown → treat as `.md`. (Ported skeleton from the reference importer, adapted to our `MarkdownNode`.)
- [ ] **A2** `mindmap.ts` — `.mind-map`/`.mind-doc` via the existing `markdownToOutline` (alias handling). Test: a `.mind-doc` round-trips identically to `.mind-map`.
- [ ] **A3** `freemind.ts` — `.mm` via `DOMParser` (`<map><node TEXT=…>` recursion; decode entities; map `COLOR`/`BACKGROUND_COLOR` → `data.color`/`fillColor`). Tests on a small `.mm` fixture (nesting + a color). (Adapt `parseFreeMind`, ref line ~278.)
- [ ] **A4** `opml.ts` (`<outline text=…>` recursion), `indented.ts` (`.md` headings+bullets / `.txt` indent), `json.ts` (`{title, outline|branches|children}`). Tests per format.
- [ ] **A5** Main: `inkproj:pickImportFile` → open dialog (all supported exts) → `{ name, text } | null`; `inkproj:createFromImport(schemaText, title)` → save dialog (`.inkproj`) → `createInkproj`. `shared/ipc.ts` + `preload` + `menuChannels`.
- [ ] **A6** `projectActions.importFile()`: `pickImportFile` → `importAny` → `outlineToMarkdown(outline, title)` → `createFromImport` → `enterProject`. Replace/extend M3's `importMindMap` (which only did raw `.mind-map`). `menu.ts` File → Import… (broaden label + filter); `i18n`; `App.tsx` wire.
- [ ] **A7** `typecheck`/`lint`/`build`; QA: import a `.mm`, `.opml`, `.mind-doc`. Commit `feat(mindmap): multi-format import hub`.

## Phase B — `.mindnode` import (binary, stretch)

**Design.** `.mindnode` = a ZIP whose `contents.xml`/protobuf carries the map (the source's `mindnode-pb.ts` reader, ~174 lines). Heavier + proprietary; **optional** — build only if Phase A lands well and there's appetite. The vision parked this pending the Protocolist lib; doing the reader ourselves is the alternative.

- [ ] **B1** `mindnode.ts` — unzip + decode the protobuf nodes → `{ title, outline }` (+ optional `viewport`). Adapt `mindnode-pb.ts`. Fixture test.
- [ ] **B2** Wire into `importAny` (binary branch: `pickImportFile` returns bytes for `.mindnode`). QA on a real `.mindnode`. Commit.

## Phase C — image assets

**Design.** Images live in the bundle's `assets/`. A node/doc can reference one; the **HTML export inlines** referenced `assets/*` as base64 (self-contained). Canvas thumbnails are deferred (needs a bundle-file protocol/IPC).

**Files:** modify `zip.ts` (`attachAsset`, `readAssetDataUri`), `index.ts`, `shared/ipc.ts`, `preload`; `exportHtml.ts` (image substitution); `projectActions.ts` (collect assets for export); a node "Attach image" action + `data.image`.

- [ ] **C1** Main `inkproj:attachAsset(workingDir)` → image dialog → copy into `assets/` (unique name) → return the bundle path. `inkproj:readAssetDataUri(workingDir, path)` → base64 data URI (path-validated; image MIME only).
- [ ] **C2** `exportHtml`: in `projectActions.exportHtml`, scan doc contents for `![alt](assets/…)`, read each via `readAssetDataUri`, pass an `assets: Record<path, dataUri>` map; `renderProjectHtml` replaces those refs with `<img>` (minimal — only `assets/*` image refs; rest stays `<pre>`). Test the substitution in `exportHtml.test`.
- [ ] **C3** (optional) Node `data.image` + an "Attach image…" action (sets the ref); shown in the HTML export under the node. Canvas thumbnail = backlog.
- [ ] **C4** `typecheck`/`lint`/`build`; QA: a doc with an image → exported HTML shows it inline. Commit.

## Phase D — gate + QA

- [ ] **D1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **D2** QA across the formats built; update `README.md`; hand off; commit/push per OK.

## Self-review / open points
- **Adapt, don't reinvent:** the reference importer (2.5k lines, client-side) is the parser source we inherit (§1a) — port the subset we want, our `MarkdownNode` shape. ✓
- **Renderer-side parse:** XML/OPML need `DOMParser` (renderer), so conversion lives in the renderer; main only does dialogs + `createInkproj`. ✓
- **Scope to confirm:** Phase A (text formats) is the high-value core; **`.mindnode` (Phase B) is optional/heavier**; assets (Phase C) can ship独立. Which phases for v1?
- **Backlog:** `.xmind` (real XMind ZIP, not the legacy `.mm`), canvas image thumbnails (bundle-file protocol), import *into* an open project (merge) vs always new.
