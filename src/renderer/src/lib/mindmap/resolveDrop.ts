import type { GraphModel } from '@shared/mindmap/types'

/** Drop within this many px of another node → act on it. */
export const REPARENT_RADIUS = 140
/** Dropped this far right of the nearest node → child zone (else sibling reorder). */
export const CHILD_DX = 100

export type DropTarget =
  | { kind: 'child'; targetId: string }
  | { kind: 'sibling'; parentId: string | null; index: number; targetId: string; before: boolean }
  | null

/**
 * Pure: resolve where a dragged node would land given the other nodes' positions.
 * `child` = become the target's child; `sibling` = reorder among the target's
 * siblings (before/after by drop Y); `null` = nothing near (snap back).
 */
export function resolveDrop(
  graph: GraphModel,
  positions: { id: string; x: number; y: number }[],
  draggedId: string,
  drop: { x: number; y: number }
): DropTarget {
  let best: { id: string; d: number; x: number; y: number } | null = null
  for (const n of positions) {
    if (n.id === draggedId) continue
    const d = Math.hypot(n.x - drop.x, n.y - drop.y)
    if (best == null || d < best.d) best = { id: n.id, d, x: n.x, y: n.y }
  }
  if (best == null || best.d > REPARENT_RADIUS) return null
  if (drop.x - best.x > CHILD_DX) return { kind: 'child', targetId: best.id }

  const t = graph.nodes.find((g) => g.id === best.id)
  if (!t) return null
  const sibs = (
    t.parentId === null
      ? graph.nodes.filter((n) => n.parentId === null).map((n) => n.id)
      : graph.childrenOf.get(t.parentId) ?? []
  ).filter((id) => id !== draggedId)
  const ti = sibs.indexOf(best.id)
  if (ti < 0) return null
  const before = drop.y < best.y
  return { kind: 'sibling', parentId: t.parentId, index: ti + (before ? 0 : 1), targetId: best.id, before }
}
