# Milestone 17 — plan (ELK auto-layout — an alternative layout engine)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.
>
> **Branch:** `feat/mindmap-elk` (off `feat/mindmap`). Merge into `feat/mindmap` after QA, then `dev`. The last open backlog item (§G).

**Goal:** Add **ELK** (`elkjs`) as an **opt-in alternative** to the hand-rolled banded
layout, for huge / auto-arranged maps. The user picks the engine (Banded ⟷ ELK) per
project; everything else (nodes, edges, collapse, direction, pins, centering) keeps working.

**Why it's its own milestone/branch:** it adds a ~1 MB dependency and turns layout
**async** (ELK returns a Promise), which the canvas currently computes synchronously
(`useMemo`). That async seam is the main risk, so it's isolated on a branch.

## Architecture

- **Engine flag** — `useProjectStore.layoutEngine: 'banded' | 'elk'` (default `banded`).
- **Banded stays synchronous** (`computeLayout`, unchanged) and is the **fallback** shown
  while ELK computes or when the engine is `banded`.
- **ELK is async** — `computeElkLayout(graph, collapsed, direction): Promise<Map<id,Pos>>`,
  computed in a Canvas effect, written to state, and preferred once ready (no flicker:
  banded shows until the ELK result lands). Stale-result races are killed by a cancel flag.
- **Pure adapters** (testable without mounting): `toElkGraph` (visible nodes + tree edges +
  per-node size + direction → ELK input) and `fromElkGraph` (ELK result → `Map<id,Pos>`).
- **Shared `applyPins`** — manual pins (`customLeft/customTop`, `offsetX/offsetY`) override
  the engine result for **both** engines (extracted from `computeLayout`).
- **Only tree edges** feed ELK (cross-links don't affect layout, same as banded).
- **Sizes** — `NODE_W`/`NODE_H` (already exported from `layout.ts`).

```
elk input:  { id:'root', layoutOptions:{...}, children:[{id,width,height}], edges:[{id,sources:[p],targets:[c]}] }
elk output: same, with x/y on each child  →  fromElkGraph → Map<id,{x,y}>  →  applyPins
```

**Conventions:** pure adapters tested + one real-ELK integration test; reuse the store / Canvas controlled-flow; commit per green group.

---

## Phase A — dependency + ELK layout function

**Files:** `package.json` (add `elkjs`); create `lib/mindmap/layoutElk.ts` (+ test); modify `lib/mindmap/layout.ts` (export `applyPins`, `visibleNodeIds`).

- [x] **A1** `npm install elkjs` (0.11.1); `import ELK from 'elkjs/lib/elk.bundled.js'` resolves + runs (verified mrtree in node).
- [x] **A2** `layout.ts`: extracted `applyPins(graph, pos)` (shared) + `visibleNodeIds(graph, collapsed)`.
- [x] **A3** `layoutElk.ts` pure adapters:
  - `toElkGraph(graph, collapsed, direction)` → `{ id:'root', layoutOptions, children, edges }`:
    - `children` = `visibleNodeIds` → `{ id, width: NODE_W, height: NODE_H }`.
    - `edges` = tree edges (`graph.edges` where `kind==='tree'`) with **both** endpoints visible → `{ id, sources:[source], targets:[target] }`.
    - `layoutOptions` by direction: `right`/`down` → `'org.eclipse.elk.mrtree'` + `'elk.direction': 'RIGHT'|'DOWN'`; `radial` → `'org.eclipse.elk.radial'`. Plus spacing (`'elk.spacing.nodeNode'`).
  - `fromElkGraph(result)` → `Map<id,{x,y}>` from `result.children[i].x/.y`.
  - [x] Tests (pure): visible-only nodes + tree edges; algorithm/direction per `direction`; `fromElkGraph` maps x/y.
- [x] **A4** `computeElkLayout` (async, `applyPins`-aware; module-level `elk`).
- [x] **A5** Real-ELK integration tests: finite distinct positions; a pin is honored. (6 tests total, fast.)
- [x] **A6** `typecheck`/`lint`/layout-test green. Commit `feat(mindmap): ELK layout engine (elkjs + pure adapters)`.

## Phase B — store flag + async Canvas integration

**Files:** modify `useProjectStore.ts` (`layoutEngine` + `setLayoutEngine`), `Canvas.tsx`.

- [x] **B1** `useProjectStore`: `layoutEngine: 'banded' | 'elk'` (init `'banded'`) + `setLayoutEngine`.
- [x] **B2** `Canvas`: keep the synchronous banded `useMemo` (`banded`). Add ELK as an async override:
  ```tsx
  const banded = useMemo(() => graph ? computeLayout(graph, collapsed, direction) : new Map(), [graph, collapsed, direction])
  const [elkLayout, setElkLayout] = useState<Map<string, Pos> | null>(null)
  useEffect(() => {
    if (engine !== 'elk' || !graph) return
    let cancelled = false
    void computeElkLayout(graph, collapsed, direction).then((m) => { if (!cancelled) setElkLayout(m) })
    return () => { cancelled = true }
  }, [engine, graph, collapsed, direction])
  const layout = engine === 'elk' && elkLayout ? elkLayout : banded
  ```
  (State is set only in the promise — no `set-state-in-effect`. Banded is shown until ELK lands, so switching engines / editing never flickers to empty. Cancel flag drops stale results.)
- [x] **B3** `centerOnNode` / drop-ghost / frames read `layout` — work with either engine.
- [x] **B4** `typecheck`/`lint` green. Commit `feat(mindmap): wire ELK layout into the canvas (async, banded fallback)`.

## Phase C — engine toggle + polish

**Files:** modify `EditToolbar.tsx`.

- [x] **C1** `EditToolbar`: a **Banded / ELK** segmented engine toggle → `setLayoutEngine`.
- [x] **C2** Direction applies under ELK (mrtree RIGHT/DOWN; radial → ELK radial).
- [x] **C3** `typecheck`/`lint`/`build` green (bundle +~3 MB from elkjs). Commit `feat(mindmap): layout-engine toggle (Banded / ELK)`.

## Phase D — gate + QA + merge

- [x] **D1** `npx vitest run` green (486; +6 layoutElk); `typecheck`/`lint`/`build` clean (bundle +~3 MB from `elkjs`).
- [ ] **D2** QA (live, `npm run dev`): toggle ELK on a small map (relayouts), a large map (auto-arranged, smooth), each direction (right/down/radial); drag a node (pin honored under ELK); collapse/expand re-runs ELK; centering + frames + drop-ghost still align. Update `README.md` + `backlog.md` (§G fully ✅). *(handed off for live QA)*
- [ ] **D3** On QA OK: **merge `feat/mindmap-elk` → `feat/mindmap`** (`--no-ff`); later `feat/mindmap` → `dev`. Push per the user's instruction.

## Risks & mitigations
- **Async races** (stale ELK result after a fast edit) → cancel flag in the effect; banded fallback means the screen is never empty.
- **Bundle size** (~1 MB) → accepted (user opted in); `elk.bundled.js` is self-contained (no worker/network).
- **ELK perf on huge maps** → ELK runs off the render path (in the effect); the banded layout shows meanwhile; **auto-collapse (M16)** already caps visible nodes, so ELK input stays bounded.
- **mrtree direction support** — RIGHT/DOWN are well-supported; radial uses the dedicated radial algorithm. If mrtree output looks off, fall back to `'org.eclipse.elk.layered'` (documented in `layoutElk.ts`).
- **Worker-free** — use `elk.bundled.js` (not `elk-worker`), so no extra bundler/CSP config; it runs synchronously inside the promise.

## Self-review
- **Opt-in & additive:** banded is untouched + default; ELK is a flag; both share `applyPins`. ✓
- **Reuses:** `NODE_W/NODE_H`, tree edges, the collapse set, the Canvas controlled-flow, `centerOnNode`. ✓
- **Isolated:** dependency + async seam live on `feat/mindmap-elk`; merged only after QA. ✓
