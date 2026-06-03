import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js'
import type { GraphModel } from '@shared/mindmap/types'
import { NODE_W, NODE_H, applyPins, visibleNodeIds, type Direction, type Pos } from './layout'

/**
 * ELK (`elkjs`) as an **alternative** layout engine to the banded layout. Async (ELK
 * returns a Promise), so the canvas runs this off the render path and keeps the banded
 * result as a fallback. Only the **visible** tree feeds ELK (cross-links don't affect
 * layout, same as banded); manual pins override the ELK result via the shared `applyPins`.
 */

const elk = new ELK()

/** Our direction → an ELK algorithm + options (mrtree for right/down, radial otherwise). */
export function elkOptions(direction: Direction): Record<string, string> {
  if (direction === 'radial') {
    return { 'elk.algorithm': 'org.eclipse.elk.radial', 'elk.spacing.nodeNode': '40' }
  }
  return {
    'elk.algorithm': 'org.eclipse.elk.mrtree',
    'elk.direction': direction === 'down' ? 'DOWN' : 'RIGHT',
    'elk.spacing.nodeNode': '40'
  }
}

/** Build the ELK input from the visible tree: a flat child list (sized) + the visible
 *  tree edges. (If mrtree output ever looks off, swap the algorithm for `…layered`.) */
export function toElkGraph(
  graph: GraphModel,
  collapsed: Set<string>,
  direction: Direction
): ElkNode {
  const visible = new Set(visibleNodeIds(graph, collapsed))
  const children = [...visible].map((id) => ({ id, width: NODE_W, height: NODE_H }))
  const edges = graph.edges
    .filter((e) => e.kind === 'tree' && visible.has(e.source) && visible.has(e.target))
    .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }))
  return { id: 'root', layoutOptions: elkOptions(direction), children, edges }
}

/** Read positions out of an ELK-laid-out graph. */
export function fromElkGraph(result: ElkNode): Map<string, Pos> {
  const pos = new Map<string, Pos>()
  for (const c of result.children ?? []) pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 })
  return pos
}

/** Async ELK layout: ELK positions for the visible tree + manual-pin overrides. */
export async function computeElkLayout(
  graph: GraphModel,
  collapsed: Set<string>,
  direction: Direction
): Promise<Map<string, Pos>> {
  const result = await elk.layout(toElkGraph(graph, collapsed, direction))
  const pos = fromElkGraph(result)
  applyPins(graph, pos)
  return pos
}
