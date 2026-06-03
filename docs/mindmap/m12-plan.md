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

- [x] **A1** `projectDocs.ts`: `projectDocs(graph)` (deduped internal docs + referencing nodeIds, sorted) + `nodesReferencing(graph, path)`. 3 tests.
- [x] **A2** `projectEditActions.linkExistingDocToSelected(path, title)` (already-linked → just open; else `pushDocRef` + open).
- [x] **A3** `DocBar`: a **Link…** `<select>` of docs not already on the selected node → links + opens.
- [x] **A4** `typecheck`/`lint` clean. Commit `feat(mindmap): link an existing doc to another node (M:N)`.

## Phase B — surface shared docs

**Files:** modify `DocBar.tsx`.

- [x] **B1** `DocBar` shows an **🔗 also:** row of chips for the *other* nodes sharing the open internal doc → `revealNode(id)`.
- [x] **B2** `typecheck`/`lint` clean. Commit `feat(mindmap): surface docs shared across nodes`.

## Phase C — project docs panel

**Files:** create `components/Mindmap/DocsPanel.tsx`; modify `useProjectStore.ts` (`docsOpen` + `toggleDocs`/`setDocsOpen`), `EditToolbar.tsx` (a Docs button), `ProjectView.tsx` (render the overlay).

- [x] **C1** `useProjectStore.docsOpen` + `toggleDocs`/`setDocsOpen` (mirrors `searchOpen`).
- [x] **C2** `DocsPanel` overlay: `projectDocs(graph)` — title (→ open via first node), an `N nodes` count, a chip per node (→ reveal); Esc / backdrop / ✕ closes.
- [x] **C3** `EditToolbar` **Docs** toggle; `ProjectView` renders `<DocsPanel>`.
- [x] **C4** `typecheck`/`lint`/`build` green. Commit `feat(mindmap): project docs panel`.

## Phase D — gate + ship

- [x] **D1** `npx vitest run` green (451; +3 projectDocs); `typecheck`/`lint`/`build` clean.
- [x] **D2** Updated `README.md` + `backlog.md` (§C reframed: tree-core + M:N docs is the model; canonical-AST is **not** our direction). Committed + pushed.

## Self-review
- **Additive:** no format change — `DocRef[]` per node already allows the same `path` on many nodes. ✓
- **Reuses:** `pushDocRef`, `nodeDocs`, `revealNode`, `openDocRef`, the `searchOpen` store pattern. ✓
- **Records the decision:** the tree is the core/SSOT; docs attach M:N; **no canonical-AST merge** (corrects the old "AST→projections" framing). ✓
- **Adjacent (backlog §E, reviewed next):** orphaned-doc GC on save ties into M:N (a doc with zero referencing nodes is a GC candidate).
