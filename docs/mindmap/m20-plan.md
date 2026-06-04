# Milestone 20 — plan (smooth collapse/expand — take 2, done right)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.
>
> **Branch:** `feat/mindmap-anim` (off `feat/mindmap`). The first attempt was reverted (`0671fec`); this is the careful redo with live QA before any merge.

**Goal:** Animate collapse/expand + relayout so the tree **glides** instead of snapping —
**without** the instability that sank the first attempt (the whole scheme vanished).

---

## Post-mortem — why the first attempt failed

The reverted approach tweened by calling, every rAF frame,
`setNodes(model.nodes.map(n => ({ ...n, position })))`. Three compounding faults:

1. **Stripped React Flow's measured sizes.** `model.nodes` (from `buildRfModel`) are *fresh*
   objects with only `{ id, type, position, data }`. After a node mounts, RF attaches measured
   dimensions (`node.measured` / `width`/`height`). Re-creating nodes from `model` each frame
   **dropped those**. With **`onlyRenderVisibleElements`** (virtualization, M16) ON, RF culls
   nodes it can't size/place → **the scheme blanked**.
2. **Per-frame full-array replacement** — replacing the whole `nodes` array 13×/animation forces
   re-reconciliation + re-measurement every frame; thrash that amplifies (1).
3. **Raced the model rebuilds** — `useProjectGraph` bumps on every Yjs mutation; on open the
   graph rebuilds several times, each `model` change cancelled the pending rAF; the deferred
   `setNodes` left gaps where nodes weren't committed.

**The lesson:** never tween over `model.nodes`. Tween over the **current RF node objects**
(which carry the measured sizes), changing **only** `position`, and keep structure changes a
single synchronous commit. And/or let **CSS** move the nodes so RF's objects are never touched.

---

## Two viable approaches

### Approach A — CSS transform transition  *(simplest, rock-solid; edges snap)*
RF sets each node's position as an inline `transform: translate(x,y)`. A scoped CSS
`transition: transform` animates that when the position changes — **RF's node objects are
never recreated**, so measured sizes + virtualization are untouched. ~6 lines.
- **Pro:** trivial, zero array thrash, virtualization-safe, can't blank the scheme.
- **Con:** **edges don't follow** — RF computes edge paths to the *final* node positions
  immediately, so during the ~200 ms glide edges sit at the destination while nodes travel.
  (Acceptable for short tree edges; noticeable on big moves.)
- Must disable the transition **during drag** (else the dragged node lags the cursor) and under
  `prefers-reduced-motion`. Pan/zoom transform the viewport, not nodes, so they're unaffected.

### Approach B — JS reconcile-tween (corrected)  *(edges follow; more code)*
Drive React Flow the idiomatic way: **update positions on the existing node objects**, never
recreate them from `model`.
- On a `model` change: **one synchronous** `setNodes(prev => reconcile(prev, model))` — for each
  model node, **keep the existing `prev` object** (its measured size!) and only refresh `data` +
  set its **start** position; add new nodes at their parent's current position; drop removed
  ones. Structure is committed at once → never blanks (the old failure mode is gone).
- Then rAF-tween: `setNodes(prev => prev.map(n => ({ ...n, position: lerp(start[n.id], target[n.id], e) })))`
  — spreads the **current** node `n` (measured size preserved), overrides only `position`. RF
  recomputes edge paths each frame from real positions → **edges follow**.
- **Pro:** smoothest, edges track nodes, virtualization-safe (sizes preserved).
- **Con:** more code; must get reconciliation + rAF cancellation + race handling right.

---

## Recommended staging

1. **Phase A (CSS) first** — ship the safe version; likely "good enough" smoothness with
   near-zero risk. Validate it never blanks (open / deep expand / rapid toggle / drag / ELK /
   large map).
2. **Phase B (JS) only if the edge-snap bothers you** — upgrade for edge-following, on the same
   branch, with the same QA matrix.

Either way: **on `feat/mindmap-anim`, behind live QA**, merged only after the failure scenarios pass.

---

## Phase A — CSS transform transition

**Files:** `components/Mindmap/Canvas.tsx` (add `className` to `<ReactFlow>`), `index.css` (a scoped rule).

- [ ] **A1** `<ReactFlow className="ink-flow" …>`.
- [ ] **A2** `index.css`:
  ```css
  .ink-flow .react-flow__node { transition: transform 200ms ease; }
  .ink-flow .react-flow__node.dragging { transition: none; }   /* don't lag the cursor */
  @media (prefers-reduced-motion: reduce) { .ink-flow .react-flow__node { transition: none; } }
  ```
  (Verify RF's dragging class name; if different, target the actual one / `[data-dragging]`.)
- [ ] **A3** `typecheck`/`lint`/`build`. Commit `feat(mindmap): smooth layout via CSS node transition`.
- [ ] **A4** **Live QA (the failure matrix):** open a project (no blank, both engines); expand deep 3–5× fast (no vanish); collapse/expand repeatedly; drag a node (no lag, snaps cleanly); switch Banded↔ELK + direction; a large (>400) map with virtualization. Edges-snap is expected — judge if acceptable.

## Phase B — JS reconcile-tween (optional upgrade, if edges-snap is unwanted)

**Files:** `components/Mindmap/Canvas.tsx` (replace the sync effect), maybe a `lib/mindmap/useLayoutTween.ts`.

- [ ] **B1** Remove the CSS transition (A2) to avoid double-animating.
- [ ] **B2** Replace the instant sync effect with: a `firstSync` instant path; else (a) one
  synchronous reconcile `setNodes` that **keeps existing node objects** (measured size) at their
  current position, adds new nodes at the parent's current slot, drops removed; (b) capture
  `start`/`target` position maps; (c) rAF-tween updating **only `position`** on the existing
  objects (`{ ...n, position }`), easeOutCubic 200 ms; cancel on next model change + on drag start.
- [ ] **B3** Edges set synchronously to `model.edges`; they follow because positions live on real nodes.
- [ ] **B4** `typecheck`/`lint`/`build` + the **same failure-matrix live QA** as A4, plus: edges visibly follow the nodes; rapid expand mid-animation stays stable; reduced-motion = instant.
- [ ] **B5** Commit `feat(mindmap): smooth layout via reconcile-tween (edges follow)`.

## Phase C — ship

- [ ] **C1** `npx vitest run` green; `typecheck`/`lint`/`build` clean.
- [ ] **C2** On QA OK, merge `feat/mindmap-anim` → `feat/mindmap` (`--no-ff`). Update README. Push per the user's word.

## Hard rules (so we don't repeat the failure)
- **Never** build the tweened array from `model.nodes` — always from the **current** RF nodes (Approach B), or don't touch them at all (Approach A).
- **Keep virtualization** (`onlyRenderVisibleElements`) ON — the animation must coexist with it (both approaches do).
- **Structure = one synchronous commit** (Approach B) — no deferring the node set to rAF.
- **Test the exact failure scenarios** (open, deep-expand ×N, large-map) on the branch before merge — this regression was invisible to the unit tests.

## Self-review
- **Roots addressed:** measured-size loss (A: untouched; B: preserved), array thrash (A: none; B: position-only), races (B: synchronous structure). ✓
- **Staged + branch + live QA:** safe CSS first; JS only if needed; nothing merged until the failure matrix passes. ✓
