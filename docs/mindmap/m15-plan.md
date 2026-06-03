# Milestone 15 — plan (the rest of backlog §B — nodes & visuals)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Close out the open tails of backlog **§B**: the remaining node **shapes**
(line / embedded), **task subtree progress rollup**, **rich-text** labels (font size /
family + inline-markdown), **custom theme palettes**, and **left+right radial** layout.

**Architecture.** All additive node `data` / layout options. Shapes extend `MindNode`'s
shape handling with a "bare" branch (no box). Progress is a pure `taskRollup(graph, id)`.
Rich text = `data.fontSize`/`fontFamily` + a tiny inline-markdown renderer for labels.
Custom palettes feed the existing `applyTheme` with an ad-hoc palette. Radial adds a
`'radial'` direction that splits the root's children left/right and tags each node's side
for handle placement (edges auto-route). Decisions: backlog §B.

**Conventions:** pure helpers tested; reuse `applyTheme`/`computeLayout`/the inspector; commit per green group.

---

## Phase A — node shapes: line / embedded

**Files:** modify `MindNode.tsx`, `NodeInspector.tsx`.

- [ ] **A1** `MindNode`: a **bare** branch for `shape === 'line'` (text + a bottom border, no box) and `shape === 'embedded'` (plain text, transparent — no border/bg/shadow). Selection ring + fill still honored.
- [ ] **A2** `NodeInspector`: add `line` / `embedded` to the shape list.
- [ ] **A3** `typecheck`/`lint`. Commit `feat(mindmap): line / embedded node shapes`.

## Phase B — task subtree progress rollup

**Files:** create `lib/mindmap/taskRollup.ts` (+ test); modify `MindNode.tsx`.

- [ ] **B1** `taskRollup(graph, id)` → `{ done, total }` over the node's **descendants** (task nodes with `status !== 'cancelled'`; `done` = `status === 'done'`). Pure; test.
- [ ] **B2** `MindNode`: when a node has task-bearing descendants (`total > 0`), show a small `done/total` badge (a mini progress pill).
- [ ] **B3** `typecheck`/`lint`. Commit `feat(mindmap): task subtree progress rollup`.

## Phase C — rich-text labels (font size / family + inline markdown)

**Files:** create `lib/mindmap/inlineMd.ts` (+ test); modify `types.ts` (`fontSize`, `fontFamily`), `MindNode.tsx`, `OutlinePanel.tsx`?, `NodeInspector.tsx`.

- [ ] **C1** `inlineMd(text)` → segments `{ text, bold?, italic?, code?, strike? }` parsing `**b**` / `*i*` / `` `c` `` / `~~s~~` (non-nesting, left-to-right). Pure; test.
- [ ] **C2** `NodeData.fontSize?: number`, `fontFamily?: string`. `MindNode`: render the label as inline-md segments (spans), with `style={{ fontSize, fontFamily }}` from data (kept inside the `truncate`).
- [ ] **C3** `NodeInspector`: a font-size number input + a font-family `<select>` (a few presets) via `apply`.
- [ ] **C4** `typecheck`/`lint`. Commit `feat(mindmap): rich-text labels (font size/family + inline markdown)`.

## Phase D — custom theme palettes

**Files:** modify `themes.ts` (`applyTheme` accepts an ad-hoc palette), `projectEditActions.ts`, `EditToolbar.tsx` (a Custom… editor).

- [ ] **D1** `applyTheme(doc, key, palette?)` — when `key === 'custom'` and a `palette` is given, recolor by depth from it (reuses the existing by-depth walk). `projectEditActions.applyCustomTheme(palette)`.
- [ ] **D2** `EditToolbar`: a **🎨 Custom…** option opens a small popover — N depth tiers × `{ fill, text, line }` color inputs (default = a starting palette) + Apply.
- [ ] **D3** `typecheck`/`lint`. Commit `feat(mindmap): custom theme palettes`.

## Phase E — left+right radial layout

**Files:** modify `layout.ts` (`'radial'` direction, + test), `rfModel.ts` (`side` on `RfNodeData`), `Canvas.tsx`, `MindNode.tsx` (handles by side), `useProjectStore.ts` (direction union), `EditToolbar.tsx` (a ⇄ option).

- [ ] **E1** `computeLayout(graph, collapsed, 'radial')` — split the root's children into right (depth on +x) and left (depth on −x) halves; each side banded independently; the root centered. Default unchanged. Test: a left child has `x < root.x`, a right child `x > root.x`; siblings on a side don't interleave.
- [ ] **E2** `rfModel`: `RfNodeData.side: 'left' | 'right'` (computed from `x` vs the root's `x`; non-radial ⇒ `'right'`). `buildRfModel` sets it.
- [ ] **E3** `MindNode`: for radial, place handles by `side` (left node → target right / source left; right node → target left / source right) + the tail control on the growth side. `useProjectStore.direction` gains `'radial'`; `EditToolbar` a ⇄ toggle; `Canvas` passes it.
- [ ] **E4** `typecheck`/`lint`/`build`. Commit `feat(mindmap): left+right radial layout`.

## Phase F — gate + ship

- [ ] **F1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **F2** Update `README.md` + `backlog.md` (§B all ✅). Commit; **push** (user pre-authorized building all of §B).

## Self-review
- **Additive:** shapes/fonts/progress/palettes/direction are node `data` or a layout option. ✓
- **Reuses:** the shape pipeline, `applyTheme`, `computeLayout`, the inspector/toolbar, handle auto-routing. ✓
- **Radial scope:** left+right split with per-node side handles; deeper radial (multiple rings / angular) is out of scope — this is the classic two-sided mind-map.
