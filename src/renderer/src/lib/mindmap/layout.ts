import type { GraphModel } from '@shared/mindmap/types'

export interface Pos {
  x: number
  y: number
}

/** Growth direction: `right` = horizontal (depth on X), `down` = vertical (depth on Y). */
export type Direction = 'right' | 'down'

// Nodes are capped (MindNode `max-w-[230px]`, single-line `truncate`), so each cell
// is uniform: a depth level lands in its own band and rows never overlap. The two
// axes need different pitches: along depth we clear the node's extent on that axis,
// across siblings we clear the other extent.
const SEP: Record<Direction, { rank: number; cross: number; root: number }> = {
  // horizontal: columns 270 apart (≥ node width), rows 46 apart (≥ node height)
  right: { rank: 270, cross: 46, root: 46 },
  // vertical: rows 96 apart (≥ node height + gap), columns 250 apart (≥ node width)
  down: { rank: 96, cross: 250, root: 250 }
}
/** Approximate rendered node box (for subtree-frame bounds; nodes are width-capped). */
export const NODE_W = 200
export const NODE_H = 34

/**
 * **Banded** tree layout. Each subtree owns a contiguous band along the cross axis —
 * leaves take one slot each, a parent is centered over its children's band, and
 * siblings' bands never interleave. So expanding a node grows the tree and pushes its
 * siblings clear (past the whole child band), instead of d3-tidy's compact
 * interleaving. A **collapsed** node is a leaf (its hidden subtree reserves no space).
 * `direction` puts depth on the X axis (`right` → horizontal) or Y axis (`down` →
 * vertical). Manual pins win: `customLeft/customTop` (absolute) or `offsetX/offsetY`
 * (delta). Cross-links don't affect layout.
 */
export function computeLayout(
  graph: GraphModel,
  collapsed: Set<string> = new Set(),
  direction: Direction = 'right'
): Map<string, Pos> {
  const pos = new Map<string, Pos>()
  const sep = SEP[direction]
  const roots = graph.nodes.filter((n) => n.parentId === null)
  let cursor = 0 // running cross-axis position for the next leaf slot

  // depth → the depth-axis coordinate; cross → the cross-axis coordinate.
  const xy = (main: number, cross: number): Pos =>
    direction === 'down' ? { x: cross, y: main } : { x: main, y: cross }

  const place = (id: string, depth: number): number => {
    const main = depth * sep.rank
    const kids = collapsed.has(id) ? [] : (graph.childrenOf.get(id) ?? [])
    if (kids.length === 0) {
      const cross = cursor
      cursor += sep.cross
      pos.set(id, xy(main, cross))
      return cross
    }
    const childCross = kids.map((kid) => place(kid, depth + 1))
    const cross = (childCross[0] + childCross[childCross.length - 1]) / 2 // center over children
    pos.set(id, xy(main, cross))
    return cross
  }

  for (const root of roots) {
    place(root.id, 0)
    cursor += sep.root // gap before the next root's band
  }

  // Manual pins override the computed slot.
  for (const node of graph.nodes) {
    const auto = pos.get(node.id) ?? { x: 0, y: 0 }
    const d = node.data
    if (typeof d.customLeft === 'number' && typeof d.customTop === 'number') {
      pos.set(node.id, { x: d.customLeft, y: d.customTop })
    } else if (typeof d.offsetX === 'number' || typeof d.offsetY === 'number') {
      pos.set(node.id, { x: auto.x + (d.offsetX ?? 0), y: auto.y + (d.offsetY ?? 0) })
    }
  }

  return pos
}

/**
 * Bounding box (in layout coords) of a node plus its **visible** subtree — the
 * basis for a group frame. Walks `childrenOf`, stopping at collapsed nodes and at
 * any node missing from `layout` (collapsed away). Returns null if `rootId` isn't laid out.
 */
export function subtreeBounds(
  graph: GraphModel,
  collapsed: Set<string>,
  layout: Map<string, Pos>,
  rootId: string
): { x: number; y: number; w: number; h: number } | null {
  const ids: string[] = []
  const walk = (id: string): void => {
    if (!layout.has(id)) return
    ids.push(id)
    if (collapsed.has(id)) return
    for (const k of graph.childrenOf.get(id) ?? []) walk(k)
  }
  walk(rootId)
  if (!ids.length) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of ids) {
    const p = layout.get(id)!
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + NODE_W)
    maxY = Math.max(maxY, p.y + NODE_H)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
