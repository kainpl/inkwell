# Milestone 18 — plan (edit-history: timeline + diff + rollback)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.
>
> **First §F item, built local-only** (no backend / no collab server — the rest of §F stays deferred). Suggested branch: build directly on `feat/mindmap` (additive, no new deps) — or a `feat/mindmap-history` branch if you prefer the merge-after-QA flow.

**Goal:** Turn the M13 schema **version history** into a proper **edit-history**: a richer
timeline (granular snapshots, not only on save), a **diff** of what each snapshot would
change, and **in-place rollback** (restore into the current map, not a new tab).

**Why build on M13, not Yjs snapshots:** Inkwell is local + single-user; the schema already
serializes to text and the version store (`saveVersion`/`listVersions`/`readVersion`, keyed
by `projectVersionId`, dedup + 50-cap) already persists snapshots. Edit-history = (1) snapshot
**more often**, (2) **diff** two parsed snapshots, (3) **rollback in place**. (A Yjs-snapshot
CRDT history is noted as a future alternative — overkill for single-user.)

## Architecture

- **Snapshots** — reuse the version store. Add a **debounced history recorder**
  (`startProjectHistory`, ~4 s idle) alongside the existing on-save snapshot, so the timeline
  fills between saves. Saved projects only (needs a `projectVersionId`; untitled → no history).
- **Diff** — pure `diffGraphs(prev, next)` over two `GraphModel`s (parse snapshot schema →
  `markdownToOutline` → `buildGraph`), keyed by node `id`: **added / removed / renamed / moved**.
- **Rollback** — `replaceOutline(doc, outline, title)`: clear + re-seed the live Yjs doc in
  **one `LOCAL_ORIGIN` transaction** (so it's a single Ctrl-Z), marks dirty. The map reverts in
  place; the M13 "Open as new tab" stays as a non-destructive alternative.
- **Panel** — upgrade `VersionsPanel` into an **Edit-History panel**: the timeline, a
  per-snapshot **diff vs the current map** (what restoring would change), a **Restore here**
  (in-place) button + the existing **Open** (new tab).

## Edge cases / safety
- **Untitled** projects (no `projectVersionId`) → history disabled (panel says "save to start history").
- **Rollback + autosave shrink-guard**: a rollback to a smaller earlier state can trip the
  autosave shrink-guard (it'll skip the auto-save); that's by design — the user confirms with an
  explicit **Save**. Document it; don't fight it.
- **Rollback is undoable** (one `LOCAL_ORIGIN` step) and the pre-rollback state is itself in
  history — so it's safe.

---

## Phase A — granular history snapshots

**Files:** create `lib/mindmap/projectHistory.ts` (+ maybe test the gate logic); modify `App.tsx` (start it).

- [x] **A1** `startProjectHistory(delay = 4000, snapshot = …)` — subscribe to `useAppStore`; when the active tab is a **dirty project with a `srcPath`** (→ a `projectVersionId`), debounce → `window.api.saveVersion(projectVersionId(srcPath), schema)` (the store dedups + prunes). Independent of the `autoSave` flag (history records regardless). Mirrors `startProjectAutoSave`.
- [x] **A2** `App.tsx` starts/stops it alongside `startProjectAutoSave`.
- [x] **A3** `typecheck`/`lint`. Commit `feat(mindmap): granular edit-history snapshots`.

## Phase B — schema diff

**Files:** create `lib/mindmap/diffGraphs.ts` (+ test).

- [x] **B1** `diffGraphs(prev, next)` → `{ added: NodeRef[]; removed: NodeRef[]; renamed: {id,from,to}[]; moved: NodeRef[] }` where `NodeRef = { id, label }`:
  - build `id → node` maps for both (nodes have stable `data.id` → `GraphNode.id`);
  - **added** = ids in `next` not in `prev`; **removed** = ids in `prev` not in `next`;
  - for ids in both: **renamed** if `label` differs; **moved** if `parentId` differs.
- [x] **B2** Tests: add a child, remove one, rename one, reparent one → each lands in the right bucket; identical graphs → all empty.
- [x] **B3** `typecheck`/`lint`. Commit `feat(mindmap): schema graph diff`.

## Phase C — in-place rollback

**Files:** modify `lib/mindmap/yjsModel.ts` or `treeOps.ts` (`replaceOutline`, + test); `projectEditActions.ts` (`rollbackToSchema`).

- [x] **C1** `replaceOutline(doc, outline, title)` — in one `LOCAL_ORIGIN` transaction: delete every node in `nodesOf(doc)`, then re-seed from `outline` (reusing the `outlineToYjs` seeding), and set `meta.title`. Test: a doc reseeded from outline B yields outline B (round-trip via `yjsToOutline`).
- [x] **C2** `projectEditActions.rollbackToSchema(schema)` — `markdownToOutline(schema)` → `replaceOutline(activeDoc, outline, title)` → mark dirty + clear selection/open-doc. (Reuses `markdownToOutline`.)
- [x] **C3** `typecheck`/`lint`. Commit `feat(mindmap): in-place rollback to a schema snapshot`.

## Phase D — Edit-History panel

**Files:** modify `components/Mindmap/VersionsPanel.tsx` (diff + Restore here), `EditToolbar.tsx` (label "History" stays).

- [x] **D1** `VersionsPanel`: each snapshot row stays (date + size + **Open**); **expanding/selecting** a row parses its schema (`readVersion` → `markdownToOutline` → `buildGraph`) and shows `diffGraphs(currentGraph, snapshotGraph)` — a compact summary (`+N · −M · ✎K · ⇄J`) + the changed node labels, framed as "Restoring this would …".
- [x] **D2** A **Restore here** button per row → `readVersion` → `rollbackToSchema` (in-place) + close. Keep **Open** (new tab) from M13.
- [x] **D3** `typecheck`/`lint`/`build`. Commit `feat(mindmap): edit-history panel (diff + in-place restore)`.

## Phase E — gate + QA

- [x] **E1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **E2** QA (live): edit a saved project, wait → new history snapshots appear; select one → the diff vs current is right; **Restore here** reverts the map in place (and Ctrl-Z undoes it); **Open** still makes a new tab; untitled shows "save to start history". *(handed off for live QA)*

## Self-review
- **Reuses:** the M13 version store + `projectVersionId` + `VersionsPanel`, `markdownToOutline`/`buildGraph`, the `startProjectAutoSave` pattern, `outlineToYjs` seeding. ✓
- **Additive & local:** no new deps, no backend; the rest of §F (multiplayer / presence / AI) stays a separate strategic track. ✓
- **Safe rollback:** one undoable transaction; pre-rollback state is in history; shrink-guard interaction documented. ✓
- **Deferred:** Yjs-snapshot CRDT history (overkill single-user); per-edit *attribution* / author (needs collab); a visual side-by-side map diff (this ships a textual/structural diff).
