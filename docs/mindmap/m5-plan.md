# Milestone 5 — plan + design (import hub + image assets)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes. **Status: plan for review** (scope/ordering to confirm before build).

**Goal:** Open/import many mind-map source formats into a new `.inkproj`, and embed images. Turns Inkwell into a real on-ramp for existing maps (FreeMind/Freeplane/XMind-legacy/MindMeister/Coggle/OPML/MindNode) plus our own `.mind-map`/`.mind-doc`.

**Architecture.** A **pure, per-format importer** maps each source → our `{ title, outline }` (MarkdownNode), then the existing path takes over: `outlineToMarkdown` → `createInkproj` (M3) → open. Text formats parse with the renderer's `DOMParser` (XML/OPML) — **adapted from the source's client importer** (`temp/ref/ai-protocolist-dev/apps/web/src/lib/mind-map-import.ts`, ours to inherit per §1a). Binary `.mindnode` (protobuf) is a separate, heavier phase. Image assets land in the bundle's `assets/` and embed (base64) in the HTML export. Decisions: [`our-vision.md`](our-vision.md) §1a interop, §8 backlog [D11].

**Conventions:** pure parsers unit-tested on fixtures; conversion in the **renderer** (needs `DOMParser`); main does file dialogs + `createInkproj`; commit per green group; one QA per phase-group.

---

## Phase A — multi-format text import (the core)

**Design.** `.mind-doc` is a **legacy alias** of `.mind-map` (same markdown+data format) — trivial. `.mm` covers the FreeMind family. Each parser returns `{ title, outline }`; `data` is filled opportunistically (colors/shape) when the source carries it.

**Files:** create `lib/mindmap/import/index.ts` (`importAny`) + per-format modules (`mindmap.ts`, `freemind.ts`, `opml.ts`, `indented.ts`, `json.ts`) + tests; modify `index.ts` (`inkproj:pickImportFile`, `inkproj:createFromImport`), `shared/ipc.ts`, `preload`, `projectActions.ts`, `menu.ts`, `i18n`, `App.tsx`.

- [x] **A1–A4** `importFormats.ts` (single focused module instead of per-format files): `importAny(name, text)` dispatches → `parseMindDoc` (.mind-map/.mind-doc via `markdownToOutline`), `parseFreeMind` (.mm via DOMParser + color/fill/line/shape/fold), `parseOpml`, `parseMarkdown` (headings+bullets, inline-strip), `parseIndented` (.txt), `parseJson`; plus `cleanTree` (prune empty leaves) + `collapseDeep`. 5 format tests (jsdom for DOMParser).
- [x] **A5** Main `inkproj:pickImportFile` (reads source text) + `inkproj:createFromImport(schema, title)` (save dialog → `createInkproj`); `shared/ipc.ts` + `preload`. (Replaced M3's raw-only `importDialog`.)
- [x] **A6** `projectActions.importMindMap()` now: `pickImportFile` → `importAny` → `outlineToMarkdown` → `createFromImport` → `enterProject`. Menu Import wired to it (label kept).
- [x] **A7** `typecheck`/`lint`/`build` green (vitest 417). Commit `feat(mindmap): multi-format import hub` (`53997e9`).

## Phase B — `.mindnode` import (binary) — **BLOCKED, deferred**

**Reality check (2026-06-03).** On inspecting the source, `.mindnode` is **~1400 lines** of deeply reverse-engineered, MindNode-version-specific protobuf (`parseMindnodeV2`: flat node list + relations, LZFSE-compressed theme blocks, per-file findings in the comments) — not the ~174-line figure first estimated. **We have no real `.mindnode` fixture to verify against**, so porting it blind would ship unverifiable binary parsing (violates "never claim green unverified"). Decision: **defer** — matches the vision's park (revisit with the Protocolist lib). Unblock by either (a) a real `.mindnode` sample to build+test against, or (b) adopting the Protocolist lib's reader.

- [ ] **B1** *(blocked)* port a node-tree extractor (pb primitives + flat-nodes→tree) — needs a fixture.
- [ ] **B2** *(blocked)* wire the binary branch into `pickImportFile`/`importAny`.

## Phase C — image assets

**Design.** Images live in the bundle's `assets/`. A node/doc can reference one; the **HTML export inlines** referenced `assets/*` as base64 (self-contained). Canvas thumbnails are deferred (needs a bundle-file protocol/IPC).

**Files:** modify `zip.ts` (`attachAsset`, `readAssetDataUri`), `index.ts`, `shared/ipc.ts`, `preload`; `exportHtml.ts` (image substitution); `projectActions.ts` (collect assets for export); a node "Attach image" action + `data.image`.

- [x] **C1** `zip.attachAsset` (copy image → `assets/`, shared `uniqueBundlePath`) + `readAssetDataUri` (in-bundle, image-MIME-only base64); IPC `inkproj:attachAsset`/`inkproj:readAssetDataUri` + preload.
- [x] **C2** HTML export inlines `![alt](assets/…)` refs as base64 `<img>` (renderProjectHtml `assets` map; `projectActions.exportHtml` collects them); unbundled refs stay literal. Substitution tested.
- [x] **C3** (chosen flow) DocBar 🖼 button → `attachImageToOpenDoc`: copy a picked image into `assets/` + insert `![](assets/…)` at the doc caret (`docView.insertAtCaret`). (Node `data.image`/canvas thumbnail = backlog.)
- [x] **C4** `typecheck`/`lint`/`build` green (vitest 418). Commit `feat(mindmap): image assets…` (`f79056c`).

## Phase D — gate + QA

- [x] **D1** `npx vitest run` green (422); `typecheck`/`lint`/`build` clean. (Phases A + C; B deferred.)
- [ ] **D2** QA imports (.mm/.opml/.mind-doc/.txt/.json) + image-in-HTML; update `README.md`; hand off. *(handed off)*

## Self-review / open points
- **Adapt, don't reinvent:** the reference importer (2.5k lines, client-side) is the parser source we inherit (§1a) — port the subset we want, our `MarkdownNode` shape. ✓
- **Renderer-side parse:** XML/OPML need `DOMParser` (renderer), so conversion lives in the renderer; main only does dialogs + `createInkproj`. ✓
- **Scope to confirm:** Phase A (text formats) is the high-value core; **`.mindnode` (Phase B) is optional/heavier**; assets (Phase C) can ship独立. Which phases for v1?
- **Backlog:** `.xmind` (real XMind ZIP, not the legacy `.mm`), canvas image thumbnails (bundle-file protocol), import *into* an open project (merge) vs always new.
