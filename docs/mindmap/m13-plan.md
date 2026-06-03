# Milestone 13 — plan (project format, persistence & resilience — all of backlog §E)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Close out backlog **§E** entirely — the remaining 7 items: untitled New
project, orphaned-doc GC, save-failure surfacing + retry, project notes in the manifest,
project schema history/versions, cross-`.inkproj` links, and canvas image thumbnails.

**Architecture.** Each is additive. New main IPC where the renderer can't touch the fs
(create-untitled, save-as, GC, pick-project); the version history **reuses the markdown
editor's `saveVersion`/`listVersions`/`readVersion`** with the schema text as content; a
`saveError` store flag + a banner surface failed saves (no toast system exists). Decisions:
[memory `inkwell-unification-strategy`]; backlog §E. Keep D7 path-safety (every fs target
validated under the working dir, symlink-safe).

**Conventions:** pure helpers tested; reuse the existing inkproj IPC/zip helpers + version IPC; commit per green group.

---

## Phase A — untitled "New project" (save-as on first save)

**Files:** modify `main/inkproj/zip.ts` (`createUntitledInkproj`, `saveInkprojAs`), `main/inkproj/index.ts` (+ IPC), `shared/ipc.ts`, `preload`, `projectActions.ts` (`newUntitledProject`, save-as on `srcPath===''`), `menu.ts`/`i18n` (a "New Project (untitled)" item — reuse `menuNewProject`? add `menuNewUntitledProject`).

- [x] **A1** `createUntitledInkproj(schemaText, title, baseDir)` — like `createInkproj` but **no srcPath file**; register `PROJECTS.set(workingDir, '')`; return `{ workingDir, manifest, schema, srcPath: '' }`. `saveInkprojAs(workingDir, payload, destPath)` — write parts, re-zip to `destPath`, `PROJECTS.set(workingDir, destPath)`, return `destPath` (guards: workingDir known).
- [x] **A2** IPC `inkproj:createUntitled` (→ OpenedInkproj) + `inkproj:saveAs(workingDir, payload)` (save dialog → `saveInkprojAs` → new srcPath). `shared/ipc.ts` + `preload`.
- [x] **A3** `projectActions.newUntitledProject()` (no dialog) → enter tab; `saveProject`: when `entry.srcPath === ''` call `saveAs` (updates `entry.srcPath` via a new store action `setSrcPath`). Menu **New Project** now creates untitled; keep "Open Project". i18n.
- [x] **A4** `typecheck`/`lint`. Commit `feat(mindmap): untitled New project (save-as on first save)`.

## Phase B — orphaned-doc GC

**Files:** modify `main/inkproj/zip.ts` (`gcDocs`), `main/inkproj/index.ts` (+ IPC), `shared/ipc.ts`, `preload`, `projectEditActions.ts` (`gcOrphanDocs`), `DocsPanel.tsx` (a Clean-up button).

- [x] **B1** `gcDocs(workingDir, keep: string[])` — walk `docs/`, `safeResolve` each, `rm` files whose bundle-rel path isn't in `keep`; return deleted rel paths. (Working-dir only; the next save re-zips without them.)
- [x] **B2** IPC `inkproj:gcDocs`; `preload`. `projectEditActions.gcOrphanDocs()` — `keep = projectDocs(graph).paths ∪ dirtyDocs.keys`; call, then mark the tab dirty (so a save persists the cleaned bundle); return the count.
- [x] **B3** `DocsPanel`: a footer **Clean up N unused** button (N = `docs/` files not referenced — computed after a refresh) → `gcOrphanDocs`. (Manual, not auto-on-save — never silently delete.)
- [x] **B4** `typecheck`/`lint`. Commit `feat(mindmap): orphaned-doc GC`.

## Phase C — save-failure surfacing + retry

**Files:** create `lib/mindmap/retry.ts` (+ test); modify `useProjectStore.ts` (`saveError` + `setSaveError`), `projectActions.ts` (`saveProject` try/retry/surface), `ProjectView.tsx` (a banner).

- [x] **C1** `retry.withRetry(fn, attempts=3, baseMs=200)` — await `fn`; on throw, backoff `baseMs * 2^i` and retry; rethrow after the last. Test (succeeds after N failures; rethrows when all fail) with an injected delay.
- [x] **C2** `useProjectStore`: `saveError: string | null` + `setSaveError`. `saveProject` wraps the IPC save in `withRetry`; on success `setSaveError(null)`; on final failure `setSaveError(message)` and rethrow (so callers know). Autosave swallows but the banner shows.
- [x] **C3** `ProjectView`: a dismissible error banner when `saveError` is set ("Couldn't save — retried N×"). 
- [x] **C4** `typecheck`/`lint`. Commit `feat(mindmap): surface + retry failed project saves`.

## Phase D — project notes in the manifest

**Files:** modify `shared/mindmap/types.ts` (`InkprojManifest.instructions?`), `useProjectStore.ts` (`manifestInstructions` + `setManifestInstructions`), `projectActions.ts` (init + save), `DocsPanel.tsx` (a notes textarea).

- [x] **D1** `InkprojManifest.instructions?: string`. `ProjectEntry.manifestInstructions: string` (init from `manifest.instructions`); `setManifestInstructions(text)` → set + `manifestDirty`. `saveProject` payload manifest includes `instructions`. `enterProject` seeds it.
- [x] **D2** `DocsPanel`: a **Project notes** textarea bound to `manifestInstructions`; if non-empty, the toolbar **Docs** button gets a dot (surfaced on open).
- [x] **D3** `typecheck`/`lint`. Commit `feat(mindmap): project notes in the manifest`.

## Phase E — project schema history / versions

**Files:** create `lib/mindmap/projectVersionId.ts` (+ test), `components/Mindmap/VersionsPanel.tsx`; modify `projectActions.ts` (snapshot on save), `useProjectStore.ts` (`versionsOpen`), `EditToolbar.tsx` (History button), `ProjectView.tsx`.

- [x] **E1** `projectVersionId(srcPath)` — stable `proj-<djb2(srcPath) base36>` matching `/^[A-Za-z0-9_-]{1,128}$/`; `''` ⇒ null (untitled isn't versioned). Test (stable, sanitized).
- [x] **E2** `saveProject`: after a successful save with a srcPath, `void window.api.saveVersion(projectVersionId(srcPath), schema)` (reuses the md editor's version store; dedups + prunes already).
- [x] **E3** `useProjectStore.versionsOpen` + toggle. `VersionsPanel` overlay: `listVersions(id)` → timestamps; **Open** a version → `readVersion` → `newUntitledProject` seeded with that schema (non-destructive restore). `EditToolbar` **History** button.
- [x] **E4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): project schema history (snapshots + restore)`.

## Phase F — cross-`.inkproj` links

**Files:** modify `main/inkproj/index.ts` (`inkproj:pickProjectFile`), `shared/ipc.ts`, `preload`, `nodeStyleOps.ts` or `crossLinkOps.ts` (`addExternalLink`), `projectEditActions.ts`, `NodeInspector.tsx`, `MindNode.tsx` (a chip).

- [x] **F1** IPC `inkproj:pickProjectFile` → open dialog (`.inkproj`) → return the chosen path (or null). `preload`.
- [x] **F2** A node stores external links in `data.extLinks: { file: string; title: string }[]` (additive). `setNodeData` ops `addExternalLink`/`removeExternalLink`. `projectEditActions.linkToProject()` (pick file → add to the selected node).
- [x] **F3** `MindNode`: a **🔗 file** chip per `extLinks` → `openProjectFromPath(file)`; `NodeInspector`: a "Link project…" button + the list (remove). 
- [x] **F4** `typecheck`/`lint`. Commit `feat(mindmap): cross-.inkproj node links`.

## Phase G — canvas image thumbnails

**Files:** create `lib/mindmap/useAssetDataUri.ts`; modify `MindNode.tsx` (render `data.image`), `NodeInspector.tsx` (Set/Clear image), `projectEditActions.ts` (`setNodeImage`).

- [x] **G1** `useAssetDataUri(workingDir, path)` — a hook with a module-level cache that resolves an `assets/…` path to a data URI via `inkproj.readAssetDataUri` (effect-loaded; returns `''` until ready). 
- [x] **G2** `projectEditActions.setNodeImage()` — `attachAsset` (file dialog) → `setNodeData({ image: path })`; `clearNodeImage`. `NodeInspector`: **Set image… / Clear**.
- [x] **G3** `MindNode`: when `data.image`, render a small thumbnail (`useAssetDataUri`) above the label (capped height, rounded).
- [x] **G4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): node image thumbnails on the canvas`.

## Phase H — gate + ship

- [x] **H1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [x] **H2** Update `README.md` + `backlog.md` (§E all ✅). Commit; **push** (user pre-authorized building all of §E).

## Self-review
- **Additive:** untitled srcPath `''`; `instructions`/`extLinks`/`image` are new optional fields; versions reuse the md store. ✓
- **Security (D7):** GC / save-as / create-untitled / pick-project all go through path-validated, `PROJECTS`-gated main helpers; external project files open only via a user file picker. ✓
- **Reuses:** `saveVersion`/`listVersions`/`readVersion`, `projectDocs`, `attachAsset`/`readAssetDataUri`, `openProjectFromPath`, the inspector/Docs panel. ✓
- **Deliberate non-choices:** GC is **manual** (never auto-delete on save); restore opens a **new** tab (non-destructive); versions snapshot the **schema** (tree), not docs (documented).
