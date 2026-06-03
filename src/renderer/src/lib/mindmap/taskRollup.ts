import type { GraphModel } from '@shared/mindmap/types'

export interface Rollup {
  done: number
  total: number
}

/**
 * Subtree task progress for every node, in one bottom-up pass: `total` counts the
 * descendant task nodes (excluding `cancelled`), `done` the completed ones. A node's
 * own task is counted in its parent's rollup, not its own. Used to badge parents.
 */
export function taskRollups(graph: GraphModel): Map<string, Rollup> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const memo = new Map<string, Rollup>()
  const compute = (id: string): Rollup => {
    const cached = memo.get(id)
    if (cached) return cached
    let done = 0
    let total = 0
    for (const childId of graph.childrenOf.get(id) ?? []) {
      const n = byId.get(childId)
      if (n?.data.task && n.data.taskStatus !== 'cancelled') {
        total++
        if (n.data.taskStatus === 'done') done++
      }
      const sub = compute(childId)
      done += sub.done
      total += sub.total
    }
    const r = { done, total }
    memo.set(id, r)
    return r
  }
  for (const n of graph.nodes) compute(n.id)
  return memo
}
