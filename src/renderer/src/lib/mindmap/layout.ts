import { hierarchy, tree } from 'd3-hierarchy'
import type { GraphModel } from '@shared/mindmap/types'

export interface Pos {
  x: number
  y: number
}

/** Cross-axis gap between siblings. */
const NODE_SEP = 60
/** Depth-axis gap between levels. */
const RANK_SEP = 200
/** Cross-axis gap between separate root subtrees (so multiple roots don't overlap). */
const ROOT_GAP = 80

/**
 * Tidy-tree positions over the tree edges (RIGHT growth: x = depth axis).
 * Manual pins win: `customLeft/customTop` (absolute) or `offsetX/offsetY`
 * (delta from the computed slot). Cross-links don't affect layout.
 *
 * M1 limitation: multiple roots are each laid out from the origin and can
 * overlap — fine for the single (often synthetic) root case; multi-root
 * spacing is a later concern.
 */
export function computeLayout(graph: GraphModel): Map<string, Pos> {
  const pos = new Map<string, Pos>()
  const roots = graph.nodes.filter((n) => n.parentId === null)

  // Lay out each root's subtree, then stack roots down the cross-axis so they
  // never overlap. The first root keeps its natural (centered) coords; each
  // later root is shifted to sit below the previous one + ROOT_GAP.
  let yCursor: number | null = null
  for (const root of roots) {
    const h = hierarchy(root.id, (id) => graph.childrenOf.get(id) ?? [])
    const laid = tree<string>().nodeSize([NODE_SEP, RANK_SEP])(h)
    // d.x = cross-axis, d.y = depth*RANK_SEP; swap for RIGHT growth.
    const local: { id: string; x: number; y: number }[] = []
    let minY = Infinity
    let maxY = -Infinity
    laid.each((d) => {
      local.push({ id: d.data, x: d.y, y: d.x })
      if (d.x < minY) minY = d.x
      if (d.x > maxY) maxY = d.x
    })
    const shift = yCursor === null ? 0 : yCursor - minY
    for (const n of local) pos.set(n.id, { x: n.x, y: n.y + shift })
    yCursor = (yCursor === null ? maxY : yCursor + (maxY - minY)) + ROOT_GAP
  }

  for (const node of graph.nodes) {
    const auto = pos.get(node.id) ?? { x: 0, y: 0 }
    const d = node.data
    if (typeof d.customLeft === 'number' && typeof d.customTop === 'number') {
      pos.set(node.id, { x: d.customLeft, y: d.customTop })
    } else if (typeof d.offsetX === 'number' || typeof d.offsetY === 'number') {
      pos.set(node.id, { x: auto.x + (d.offsetX ?? 0), y: auto.y + (d.offsetY ?? 0) })
    } else {
      pos.set(node.id, auto)
    }
  }

  return pos
}
