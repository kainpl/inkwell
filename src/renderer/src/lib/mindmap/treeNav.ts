import type { GraphModel } from '@shared/mindmap/types'

/** Node ids whose label contains `query` (case-insensitive), in tree (DFS) order. */
export function searchNodes(graph: GraphModel, query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id)
}

export type NavDir = 'up' | 'down' | 'left' | 'right'

/** Structural neighbor of `id`: up/down = prev/next sibling, left = parent,
 *  right = first child. Null when there's no neighbor in that direction. */
export function navigate(graph: GraphModel, id: string, dir: NavDir): string | null {
  const node = graph.nodes.find((n) => n.id === id)
  if (!node) return null
  if (dir === 'left') return node.parentId
  if (dir === 'right') return (graph.childrenOf.get(id) ?? [])[0] ?? null
  const siblings =
    node.parentId === null
      ? graph.nodes.filter((n) => n.parentId === null).map((n) => n.id)
      : (graph.childrenOf.get(node.parentId) ?? [])
  const i = siblings.indexOf(id)
  if (i < 0) return null
  return siblings[dir === 'up' ? i - 1 : i + 1] ?? null
}

/** Collapsed set that reveals the tree down to `level` (every node at depth ≥ level
 *  that has children is collapsed). Level 1 = root + its children visible. */
export function expandToLevel(graph: GraphModel, level: number): Set<string> {
  const collapsed = new Set<string>()
  for (const n of graph.nodes) {
    if (n.depth >= level && (graph.childrenOf.get(n.id)?.length ?? 0) > 0) collapsed.add(n.id)
  }
  return collapsed
}

/** A node's ancestor chain, root → immediate parent (excludes the node itself). */
export function ancestorsOf(graph: GraphModel, id: string): string[] {
  const parentOf = new Map(graph.nodes.map((n) => [n.id, n.parentId]))
  const chain: string[] = []
  let cur = parentOf.get(id) ?? null
  while (cur != null) {
    chain.push(cur)
    cur = parentOf.get(cur) ?? null
  }
  return chain.reverse()
}
