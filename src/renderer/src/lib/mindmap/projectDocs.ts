import type { GraphModel } from '@shared/mindmap/types'

/** A bundle doc plus every node that references it (the M:N view of attachments). */
export interface ProjectDoc {
  path: string
  title: string
  nodeIds: string[]
}

/**
 * Aggregate all **internal** (in-bundle) doc refs across the tree, deduped by path,
 * each with the node ids that reference it — the basis for "link existing", the
 * shared-with surfacing, and the docs panel. External refs are excluded (they aren't
 * sharable bundle files). Sorted by title for a stable picker.
 */
export function projectDocs(graph: GraphModel): ProjectDoc[] {
  const byPath = new Map<string, ProjectDoc>()
  for (const n of graph.nodes) {
    const docs = Array.isArray(n.data.docs) ? n.data.docs : []
    for (const ref of docs) {
      if (ref.external || !ref.path) continue
      const existing = byPath.get(ref.path)
      if (existing) existing.nodeIds.push(n.id)
      else byPath.set(ref.path, { path: ref.path, title: ref.title || ref.path, nodeIds: [n.id] })
    }
  }
  return [...byPath.values()].sort((a, b) => a.title.localeCompare(b.title))
}

/** Node ids whose attachments include an internal ref to `path`. */
export function nodesReferencing(graph: GraphModel, path: string): string[] {
  const ids: string[] = []
  for (const n of graph.nodes) {
    const docs = Array.isArray(n.data.docs) ? n.data.docs : []
    if (docs.some((r) => !r.external && r.path === path)) ids.push(n.id)
  }
  return ids
}
