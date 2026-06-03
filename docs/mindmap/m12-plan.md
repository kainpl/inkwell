# Milestone 12 — plan (many-to-many node ↔ doc links)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Finish the **tree-core + docs-as-attachments** model (the project's actual
architecture — the tree is the SSOT; markdown docs just attach to nodes, **many-to-many**).
The data already allows M:N (two nodes can both reference `docs/foo.md`); this milestone
makes it **first-class**: link an existing bundle doc to another node, see which nodes share
a doc, and browse all project docs.

**Architecture.** Pure graph helpers (`projectDocs`, `nodesReferencing`) aggregate
`node.data.docs` across the tree; a `linkExistingDocToSelected` op reuses `pushDocRef`;
the `DocBar` gains a **Link…** picker + a **shared-with** chip row; a `DocsPanel` overlay
lists every doc with its referencing nodes. No format change — `DocRef[]` per node already
supports M:N. Decision: [memory `inkwell-unification-strategy`]; backlog §E.

**Conventions:** pure helpers tested; reuse `pushDocRef`/`revealNode`/`openDocRef`; commit per green group.

---

## Phase A — link an existing bundle doc to another node

**Files:** create `lib/mindmap/projectDocs.ts` (+ test); modify `projectEditActions.ts`, `DocBar.tsx`.

- [ ] **A1** `projectDocs.ts` pure: `projectDocs(graph)` → `{ path, title, nodeIds[] }[]` (unique internal doc paths across all nodes, sorted by title) and `nodesReferencing(graph, path)` → node ids referencing it. Test (dedup; M:N counts).
- [ ] **A2** `projectEditActions.linkExistingDocToSelected(path, title)`: if the selected node already links it, just open it; else `pushDocRef` + mark dirty + open.
- [ ] **A3** `DocBar`: a **Link…** `<select>` of project docs not already on the selected node → links + opens.
- [ ] **A4** `typecheck`/`lint`. Commit `feat(mindmap): link an existing doc to another node (M:N)`.

## Phase B — surface shared docs

**Files:** modify `DocBar.tsx`.

- [ ] **B1** When the open internal doc is referenced by >1 node, `DocBar` shows a **shared-with** row: a chip per *other* referencing node → `revealNode(id)` (expand ancestors + select + center).
- [ ] **B2** `typecheck`/`lint`. Commit `feat(mindmap): surface docs shared across nodes`.

## Phase C — project docs panel

**Files:** create `components/Mindmap/DocsPanel.tsx`; modify `useProjectStore.ts` (`docsOpen` + `toggleDocs`/`setDocsOpen`), `EditToolbar.tsx` (a Docs button), `ProjectView.tsx` (render the overlay).

- [ ] **C1** `useProjectStore`: `docsOpen` + `toggleDocs`/`setDocsOpen` (mirrors `searchOpen`).
- [ ] **C2** `DocsPanel`: an overlay listing `projectDocs(graph)` — title (click → open via its first node), an `N nodes` count, a chip per node (→ reveal). Esc / a close button dismisses.
- [ ] **C3** `EditToolbar`: a **Docs** toggle; `ProjectView` renders `<DocsPanel>` when `docsOpen`.
- [ ] **C4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): project docs panel (all docs + referencing nodes)`.

## Phase D — gate + ship

- [ ] **D1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **D2** Update `README.md` + `backlog.md` (reframe §C: tree-core + M:N docs is the model; canonical-AST is **not** our direction). Commit; **push** (user pre-authorized commit-push for M12).

## Self-review
- **Additive:** no format change — `DocRef[]` per node already allows the same `path` on many nodes. ✓
- **Reuses:** `pushDocRef`, `nodeDocs`, `revealNode`, `openDocRef`, the `searchOpen` store pattern. ✓
- **Records the decision:** the tree is the core/SSOT; docs attach M:N; **no canonical-AST merge** (corrects the old "AST→projections" framing). ✓
- **Adjacent (backlog §E, reviewed next):** orphaned-doc GC on save ties into M:N (a doc with zero referencing nodes is a GC candidate).
