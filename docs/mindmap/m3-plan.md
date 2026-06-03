# Milestone 3 — plan + design (project lifecycle: New · Import · Export)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Fill the creation + interop gaps. Today you can only *open* an existing `.inkproj`. M3 adds: **New project**, **Import a standalone `.mind-map`** → new `.inkproj`, and **Export** the active schema → standalone `.mind-map`. Completes D10 (two creation paths) + D11 (`.mind-map` round-trip interop).

**Architecture:** New/Import create a real `.inkproj` on disk up front (user picks the path), then reuse the existing open flow (`enterProject`) — so all M2/M2c editing + Save work unchanged. Export serializes the live Yjs (`yjsToOutline` → `outlineToMarkdown`) to a user-picked `.mind-map`. All new file I/O is main-side + user-granted via dialogs. Decisions: [`our-vision.md`](our-vision.md) §6 (D10, D11), §1a interop.

**Conventions:** IPC via `shared/ipc.ts`; main-side dialogs (no renderer paths); commit per green group; one QA at the end.

---

## Phase M3.1 — New project

**Design.** A new project = pick a destination `.inkproj` → main writes a fresh bundle (default manifest + a one-root `schema.mind-map`) → open it as a project tab. Already saved-backed, so editing/Save just work.

**Files:** modify `zip.ts` (+ test) — `createInkproj`; `index.ts` (`inkproj:createDialog`); `shared/ipc.ts`, `preload`; `projectActions.ts` (`newProject`); `menu.ts`, `App.tsx`, `shared/ipc.ts` (`menuNewProject`).

- [ ] **M3.1.1** `zip.ts createInkproj(srcPath, schemaText, title, baseDir)`: make a working dir; write `manifest.json` (`format:'inkproj', formatVersion:1, app:'Inkwell', title, schema:'schema.mind-map', createdAt`) + `schema.mind-map` + an empty `docs/`; zip → `srcPath`; `PROJECTS.set(workingDir, srcPath)`; return `OpenedInkproj`. zip.test: create → re-open → manifest.title + schema round-trip.
- [ ] **M3.1.2** `index.ts` `inkproj:createDialog`: save dialog (`.inkproj`) → `createInkproj(path, DEFAULT_SCHEMA, 'Untitled', base)` → return `OpenedInkproj | null`. `DEFAULT_SCHEMA = '# Untitled\n'` (one root).
- [ ] **M3.1.3** `shared/ipc.ts` `inkprojCreateDialog` + `menuNewProject`; `preload` `inkproj.createDialog()`.
- [ ] **M3.1.4** `projectActions.newProject()` → `const o = await window.api.inkproj.createDialog(); if (o) enterProject(o)`. `menu.ts` File → New Project (after Open Project); `App.tsx` wires `menuNewProject` → `newProject`.
- [ ] **M3.1.5** `typecheck`/`lint`. **M3.1.6** commit `feat(mindmap): new project (create + open)`.

## Phase M3.2 — Import `.mind-map`

**Design.** Pick a standalone `.mind-map`/`.md` → read its text → pick a destination `.inkproj` → create a bundle with that text as `schema.mind-map` → open it. Reuses `createInkproj`.

**Files:** modify `index.ts` (`inkproj:importDialog`); `shared/ipc.ts`, `preload`; `projectActions.ts` (`importMindMap`); `menu.ts`, `App.tsx`.

- [ ] **M3.2.1** `index.ts` `inkproj:importDialog`: open dialog (`.mind-map`,`.md`,`.markdown`) → read text → save dialog (`.inkproj`) → `createInkproj(dest, text, basename(src), base)` → return `OpenedInkproj | null`.
- [ ] **M3.2.2** `shared/ipc.ts` `inkprojImportDialog` + `menuImportMindMap`; `preload` `inkproj.importDialog()`.
- [ ] **M3.2.3** `projectActions.importMindMap()` → dialog flow → `enterProject`. `menu.ts` File → Import Mind-map…; `App.tsx` wire.
- [ ] **M3.2.4** `typecheck`/`lint`. **M3.2.5** commit `feat(mindmap): import .mind-map → new project`.

## Phase M3.3 — Export `.mind-map`

**Design.** Active project tab → serialize the live Yjs (`outlineToMarkdown(yjsToOutline(doc), title)`) → user-picked `.mind-map` path (a one-way share; the schema is grokkable standalone).

**Files:** modify `index.ts` (`inkproj:exportMindMap`); `shared/ipc.ts`, `preload`; `projectActions.ts` (`exportMindMap`); `menu.ts`, `App.tsx`.

- [ ] **M3.3.1** `index.ts` `inkproj:exportMindMap(schemaText, suggestedName)`: save dialog (`.mind-map`, default name) → write `schemaText` to the chosen path → return the path or null.
- [ ] **M3.3.2** `shared/ipc.ts` `inkprojExportMindMap` + `menuExportMindMap`; `preload` `inkproj.exportMindMap(schemaText, name)`.
- [ ] **M3.3.3** `projectActions.exportMindMap()`: from the active project tab build `schema = outlineToMarkdown(yjsToOutline(doc), title)` → `window.api.inkproj.exportMindMap(schema, title + '.mind-map')`. `menu.ts` File → Export Mind-map… (enabled is fine always; no-op when not a project tab); `App.tsx` wire.
- [ ] **M3.3.4** `typecheck`/`lint`/`build`. **M3.3.5** commit `feat(mindmap): export schema → .mind-map`.

## Phase M3.4 — gate + QA

- [ ] **M3.4.1** `npx vitest run` green (known `Editor.tab.test.tsx` jsdom error remains); `typecheck`/`lint`/`build` clean.
- [ ] **M3.4.2** Manual QA: New Project → edit → Save → reopen; Import a `.mind-map` (e.g. exported from a project) → round-trips; Export the fixture → the `.mind-map` opens in any editor + re-imports.
- [ ] **M3.4.3** Update `docs/mindmap/README.md` → M3 shipped (per QA OK).
- [ ] **M3.4.4** Hand off for QA; commit/push per the user's OK.

## Self-review
- **Reuses open/save:** New/Import create a real `.inkproj` then `enterProject` (no untitled-project special-casing); Export reuses `outlineToMarkdown`. ✓
- **Interop (D11/§1a):** Import/Export make `.mind-map` ⇄ `.inkproj` a real round-trip — the heart of two-way interop. ✓
- **Security:** all new I/O is main-side, user-granted via dialogs; `createInkproj` writes a fresh working dir + registers it in `PROJECTS`. ✓
- **Backlog (later):** untitled "New" without an up-front path (save-as-on-first-save); `.mindnode`/FreeMind import; export to standalone HTML.
