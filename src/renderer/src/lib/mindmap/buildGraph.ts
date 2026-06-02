import type { GraphEdge, GraphModel, GraphNode, MarkdownNode } from '@shared/mindmap/types'

export interface BuildGraphOptions {
  onWarn?: (message: string) => void
}

/**
 * Flatten a parsed outline into the engine-agnostic graph model (D8): tree
 * edges from nesting + typed cross-link edges from each node's `data.links`,
 * with `childrenOf` and reverse `incomingCross` indexes built in memory (D4).
 * Nodes without an explicit `data.id` get a deterministic path-based id.
 */
export function buildGraph(outline: MarkdownNode[], opts: BuildGraphOptions = {}): GraphModel {
  const nodes: GraphNode[] = []
  const childrenOf = new Map<string, string[]>()
  const treeEdges: GraphEdge[] = []
  const ids = new Set<string>()

  const walk = (node: MarkdownNode, parentId: string | null, depth: number, path: number[]): string => {
    const explicit = node.data?.id
    const id = typeof explicit === 'string' && explicit ? explicit : `node-${path.join('-')}`
    ids.add(id)
    nodes.push({ id, label: node.name ?? '', depth, parentId, data: node.data ?? {} })

    const childIds: string[] = []
    ;(node.children ?? []).forEach((child, i) => {
      const childId = walk(child, id, depth + 1, [...path, i])
      childIds.push(childId)
      treeEdges.push({ id: `tree:${id}>${childId}`, source: id, target: childId, kind: 'tree' })
    })
    childrenOf.set(id, childIds)
    return id
  }
  outline.forEach((root, i) => walk(root, null, 0, [i]))

  const crossEdges: GraphEdge[] = []
  const incomingCross = new Map<string, GraphEdge[]>()
  for (const node of nodes) {
    const links = node.data.links
    if (!Array.isArray(links)) continue
    for (const link of links) {
      if (!link || typeof link.to !== 'string') continue
      if (!ids.has(link.to)) {
        opts.onWarn?.(`cross-link "${link.id ?? ''}" → unknown node "${link.to}"`)
        continue
      }
      const edge: GraphEdge = {
        id: link.id || `cross:${node.id}>${link.to}`,
        source: node.id,
        target: link.to,
        kind: 'cross',
        type: link.type,
        label: link.label
      }
      crossEdges.push(edge)
      const incoming = incomingCross.get(link.to) ?? []
      incoming.push(edge)
      incomingCross.set(link.to, incoming)
    }
  }

  return { nodes, edges: [...treeEdges, ...crossEdges], childrenOf, incomingCross }
}
