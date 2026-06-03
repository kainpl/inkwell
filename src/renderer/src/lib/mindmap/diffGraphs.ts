import type { GraphModel } from '@shared/mindmap/types'

export interface NodeRef {
  id: string
  label: string
}

export interface GraphDiff {
  added: NodeRef[]
  removed: NodeRef[]
  renamed: { id: string; from: string; to: string }[]
  moved: NodeRef[]
}

/**
 * Structural diff between two schema graphs, keyed by stable node `id`: nodes present
 * only in `next` are **added**, only in `prev` **removed**; nodes in both with a changed
 * `label` are **renamed** and with a changed `parentId` are **moved**. Used by the
 * edit-history panel ("restoring this snapshot would …").
 */
export function diffGraphs(prev: GraphModel, next: GraphModel): GraphDiff {
  const p = new Map(prev.nodes.map((n) => [n.id, n]))
  const n = new Map(next.nodes.map((x) => [x.id, x]))
  const diff: GraphDiff = { added: [], removed: [], renamed: [], moved: [] }
  for (const [id, node] of n) {
    const before = p.get(id)
    if (!before) {
      diff.added.push({ id, label: node.label })
      continue
    }
    if (before.label !== node.label) diff.renamed.push({ id, from: before.label, to: node.label })
    if (before.parentId !== node.parentId) diff.moved.push({ id, label: node.label })
  }
  for (const [id, node] of p) {
    if (!n.has(id)) diff.removed.push({ id, label: node.label })
  }
  return diff
}
