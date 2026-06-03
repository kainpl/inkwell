import type { GraphModel } from '@shared/mindmap/types'

export interface Pos {
  x: number
  y: number
}

/** Growth direction: `right` = horizontal (depth on X), `down` = vertical (depth on Y),
 *  `radial` = the root's children split left/right of center (classic two-sided map). */
export type Direction = 'right' | 'down' | 'radial'

// Nodes are capped (MindNode `max-w-[230px]`, single-line `truncate`), so each cell
// is uniform: a depth level lands in its own band and rows never overlap. The two
// axes need different pitches: along depth we clear the node's extent on that axis,
// across siblings we clear the other extent.
const SEP: Record<'right' | 'down', { rank: number; cross: number; root: number }> = {
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
  const sep = SEP[direction === 'radial' ? 'right' : direction]
  const roots = graph.nodes.filter((n) => n.parentId === null)

  if (direction === 'radial') {
    placeRadial(graph, collapsed, roots[0]?.id, sep, pos)
  } else {
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

/** Radial layout: the root's children split into a right (depth on +x) and a left
 *  (depth on −x) half, each banded with its own cross cursor (both from 0 → symmetric),
 *  the root centered between them. Only the first root is used. */
function placeRadial(
  graph: GraphModel,
  collapsed: Set<string>,
  rootId: string | undefined,
  sep: { rank: number; cross: number; root: number },
  pos: Map<string, Pos>
): void {
  if (!rootId) return
  const kids = collapsed.has(rootId) ? [] : (graph.childrenOf.get(rootId) ?? [])
  const mid = Math.ceil(kids.length / 2)
  let rCursor = 0
  let lCursor = 0
  const place = (id: string, depth: number, sign: 1 | -1): number => {
    const x = sign * depth * sep.rank
    const ks = collapsed.has(id) ? [] : (graph.childrenOf.get(id) ?? [])
    if (ks.length === 0) {
      const cross = sign > 0 ? rCursor : lCursor
      if (sign > 0) rCursor += sep.cross
      else lCursor += sep.cross
      pos.set(id, { x, y: cross })
      return cross
    }
    const cs = ks.map((k) => place(k, depth + 1, sign))
    const cross = (cs[0] + cs[cs.length - 1]) / 2
    pos.set(id, { x, y: cross })
    return cross
  }
  const crosses = [
    ...kids.slice(0, mid).map((id) => place(id, 1, 1)),
    ...kids.slice(mid).map((id) => place(id, 1, -1))
  ]
  const rootY = crosses.length ? (Math.min(...crosses) + Math.max(...crosses)) / 2 : 0
  pos.set(rootId, { x: 0, y: rootY })
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
