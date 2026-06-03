import type { GraphModel } from '@shared/mindmap/types'
import { expandToLevel, visibleInOrder } from './treeNav'

/**
 * The collapse `Set` that keeps a large map navigable: the **deepest** expand-level
 * whose visible-node count stays ≤ `maxVisible` (≥ level 1). An empty set if the fully
 * expanded map already fits. Used by the Fit action + on-open for very large maps.
 */
export function autoCollapse(graph: GraphModel, maxVisible: number): Set<string> {
  if (visibleInOrder(graph, new Set()).length <= maxVisible) return new Set()
  const maxDepth = graph.nodes.reduce((m, n) => Math.max(m, n.depth), 0)
  for (let level = maxDepth; level >= 1; level--) {
    const collapsed = expandToLevel(graph, level)
    if (visibleInOrder(graph, collapsed).length <= maxVisible) return collapsed
  }
  return expandToLevel(graph, 1)
}
