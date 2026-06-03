import type { GraphModel } from '@shared/mindmap/types'

export interface Pos {
  x: number
  y: number
}

// Nodes are capped (MindNode `max-w-[230px]`, single-line `truncate`), so each cell
// is uniform: a depth level lands in its own column and rows never overlap.
/** Cross-axis (vertical) row pitch — ≥ a single-line node's height + gap. */
const NODE_SEP = 46
/** Depth-axis (horizontal) column pitch — ≥ the max node width (230) + a gap. */
const RANK_SEP = 270
/** Cross-axis gap between separate root subtrees. */
const ROOT_GAP = 46

/**
 * **Banded** tree layout (RIGHT growth: x = depth axis). Each subtree owns a
 * contiguous vertical band — leaves take one row each, a parent is centered over
 * its children's band, and siblings' bands never interleave. So expanding a node
 * grows the tree and pushes its siblings clear (above/below the whole child band),
 * instead of d3-tidy's compact interleaving. A **collapsed** node is a leaf (its
 * hidden subtree reserves no space). Manual pins win: `customLeft/customTop`
 * (absolute) or `offsetX/offsetY` (delta). Cross-links don't affect layout.
 */
export function computeLayout(graph: GraphModel, collapsed: Set<string> = new Set()): Map<string, Pos> {
  const pos = new Map<string, Pos>()
  const roots = graph.nodes.filter((n) => n.parentId === null)
  let cursor = 0 // running cross-axis (vertical) position for the next leaf row

  const place = (id: string, depth: number): number => {
    const x = depth * RANK_SEP
    const kids = collapsed.has(id) ? [] : (graph.childrenOf.get(id) ?? [])
    if (kids.length === 0) {
      const y = cursor
      cursor += NODE_SEP
      pos.set(id, { x, y })
      return y
    }
    const childYs = kids.map((kid) => place(kid, depth + 1))
    const y = (childYs[0] + childYs[childYs.length - 1]) / 2 // center over children
    pos.set(id, { x, y })
    return y
  }

  for (const root of roots) {
    place(root.id, 0)
    cursor += ROOT_GAP // gap before the next root's band
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
