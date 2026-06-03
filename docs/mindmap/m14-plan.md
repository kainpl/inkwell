# Milestone 14 — plan (import / export / interop — the rest of backlog §D)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Close out backlog **§D** — the remaining 5 items: `.xmind` import, import
**into** an open project (merge under a node), subtitle / two-tier node text on import,
**interactive** HTML export, and a `.mindnode` **writer** (export).

**Architecture.** `.xmind` is a ZIP → parse `content.json` (XMind Zen) / `content.xml`
(XMind 8) with `JSZip` (already a renderer dep, per `importMindnode`); main returns the
binary as base64 like `.mindnode`. Merge-import reuses `importAny` + a new `treeOps`
insert. Subtitle = a general "split a node's first newline into title + `data.note`",
applied to foreign imports. Interactive export adds an opt-in inline `<script>` to
`renderProjectHtml` (the static path stays default). The `.mindnode` writer is the inverse
of the reader's protobuf walk — **best-effort, verified by round-tripping through our own
reader** (MindNode-app compatibility is unverified — no app here to test against). Decisions:
backlog §D. Keep D7 path-safety; binary imports go through the existing base64 channel.

**Conventions:** pure parsers/encoders tested; reuse `importAny`/`treeOps`/`renderProjectHtml`; commit per green group.

---

## Phase A — `.xmind` import (real XMind ZIP)

**Files:** create `lib/mindmap/importXmind.ts` (+ test); modify `importFormats.ts` (extensions), `main/inkproj/index.ts` (return base64 for `.xmind`), `projectActions.ts` (`importMindMap` dispatch).

- [x] **A1** `importXmind(bytes)`: `JSZip` → read `content.json` (Zen: `[ { rootTopic } ]`, `children.attached[]`) or fall back to `content.xml` (XMind 8: `<topic><title>…</title><children><topics><topic>…`). Map to `{ title, outline }` via `cleanImportedOutline`. Test on a synthetic `content.json` (+ a malformed-file error).
- [x] **A2** Main `IMPORT_FILTER` + `pickImportFile` return base64 for `.xmind` (binary ZIP), like `.mindnode`. `SUPPORTED_IMPORT_EXTENSIONS` note.
- [x] **A3** `projectActions.importMindMap`: when `picked.base64`, dispatch by extension — `.mindnode` → `importMindnode`, `.xmind` → `importXmind`.
- [x] **A4** `typecheck`/`lint`. Commit `feat(mindmap): .xmind import`.

## Phase B — import into an open project (merge under a node)

**Files:** modify `treeOps.ts` (`insertOutlineUnder`), `projectEditActions.ts` (`importIntoProject`), `shared/ipc.ts` (+ `menuImportIntoProject`), `preload`, `menu.ts`, `i18n`, `App.tsx`.

- [x] **B1** `treeOps.insertOutlineUnder(doc, parentId, nodes)` — recursively create Yjs nodes for a `MarkdownNode[]` under `parentId` (one undo step); returns the new top ids. Test.
- [x] **B2** `projectEditActions.importIntoProject()` — pick a file (reuse `pickImportFile`) → `importAny`/`importMindnode`/`importXmind` → `insertOutlineUnder(selected ?? root)`; expand + mark dirty.
- [x] **B3** Menu **File → Import into Project…** (`menuImportIntoProject`); i18n en/uk/ru; `App.tsx` + `menuChannels`.
- [x] **B4** `typecheck`/`lint`. Commit `feat(mindmap): import a map into the open project (merge under a node)`.

## Phase C — subtitle / two-tier node text on import

**Files:** modify `importFormats.ts` (`splitSubtitle`), `importMindnode.ts` / `importXmind.ts` (apply for foreign formats).

- [x] **C1** `splitSubtitle(outline)` — for each node whose `name` has a newline, keep the first line as `name` and move the rest into `data.note` (preserving an existing note). Pure; test.
- [x] **C2** Apply in the foreign importers (NOT native `.mind-map`, which round-trips multi-line names losslessly): `importAny` non-native branches + `importMindnode` + `importXmind`.
- [x] **C3** `typecheck`/`lint`. Commit `feat(mindmap): two-tier node text on import (title + subtitle)`.

## Phase D — interactive HTML export

**Files:** modify `lib/mindmap/exportHtml.ts` (+ test), `projectActions.ts` (`exportInteractiveHtml`), `shared/ipc.ts` (+ menu channel), `preload`, `menu.ts`, `i18n`, `App.tsx`.

- [x] **D1** `HtmlExportInput.interactive?: boolean`. When true, parent `<li>`s get a clickable caret and a small inline `<script>` toggles `.collapsed` on a branch (`<ul>` hidden via CSS). The static path (default false) is unchanged — the existing `not.toContain('<script')` test still passes. Test the interactive branch contains the toggle script + a `.collapsed` rule.
- [x] **D2** `projectActions.exportInteractiveHtml()` (reuses `buildProjectHtml` shape with `interactive: true`). Menu **Export Project as ▸ Interactive HTML…** (`menuExportProjectInteractive`); i18n; `App.tsx` + `menuChannels`.
- [x] **D3** `typecheck`/`lint`/`build`. Commit `feat(mindmap): interactive HTML export (collapsible branches)`.

## Phase E — `.mindnode` writer (export)

**Files:** create `lib/mindmap/exportMindnode.ts` (+ test); modify `main/inkproj/index.ts` (write binary), `shared/ipc.ts`, `preload`, `projectActions.ts`, `menu.ts`, `i18n`, `App.tsx`.

- [x] **E1** `exportMindnode.ts`: pure protobuf encoders (`pbVarint`/`pbLenField`/`pbField`) + `outlineToMindnodeContents(title, outline)` building the inverse of the reader — per-node `id`+title (`content.f11 → f1[] → f4[] → f1`), `mm.f2[]` node list, `mm.f3.f2[]` relations (child/parent/order), `mm.f1.f1` root — then `Contents.data` bytes. Test: **round-trips through `mindnodeContentsToOutline`** (names + structure preserved).
- [x] **E2** `exportMindnodeZip(contents)` (renderer, `JSZip`) → `.mindnode` ZIP (`Contents.data`) as a Uint8Array → base64; main `inkproj:exportBinary(base64, suggestedName)` writes it via a save dialog. `shared/ipc.ts` + `preload`.
- [x] **E3** `projectActions.exportMindnode()` builds + writes; menu **Export Schema as ▸ MindNode (.mindnode)**; i18n; `App.tsx`. Note in the UI/docs that **MindNode-app compatibility is unverified** (round-trips through Inkwell).
- [x] **E4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): .mindnode writer (export)`.

## Phase F — gate + ship

- [x] **F1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [x] **F2** Update `README.md` + `backlog.md` (§D all ✅; note the `.mindnode`-writer caveat). Commit; **push** (user pre-authorized building all of §D).

## Self-review
- **Additive:** new importers/exporters; subtitle is `data.note`; interactive export is opt-in. ✓
- **Reuses:** `JSZip` (renderer), `importAny`/`cleanImportedOutline`, `treeOps`, `renderProjectHtml`, the base64 binary channel + a generic save. ✓
- **Honest scope:** the `.mindnode` writer is verified against our own reader; MindNode-app interop is **unverified** (documented), since there's no MindNode app here to test.
