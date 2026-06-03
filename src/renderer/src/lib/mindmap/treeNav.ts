import type { GraphModel } from '@shared/mindmap/types'

/** Node ids whose label contains `query` (case-insensitive), in tree (DFS) order. */
export function searchNodes(graph: GraphModel, query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id)
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
