import { describe, it, expect } from 'vitest'
import { autoCollapse } from './autoCollapse'
import { visibleInOrder } from './treeNav'
import { buildGraph } from './buildGraph'
import type { MarkdownNode } from '@shared/mindmap/types'

describe('autoCollapse', () => {
  it('returns an empty set when the map already fits', () => {
    const g = buildGraph([{ name: 'R', data: { id: 'r' }, children: [{ name: 'A', data: { id: 'a' } }] }])
    expect(autoCollapse(g, 100).size).toBe(0)
  })

  it('collapses a large map under the visible limit', () => {
    // root → 5 branches × 5 leaves = 31 nodes
    const branch = (id: string): MarkdownNode => ({
      name: id,
      data: { id },
      children: Array.from({ length: 5 }, (_, i) => ({ name: `${id}${i}`, data: { id: `${id}${i}` } }))
    })
    const graph = buildGraph([
      { name: 'R', data: { id: 'r' }, children: Array.from({ length: 5 }, (_, i) => branch(`a${i}`)) }
    ])
    const collapsed = autoCollapse(graph, 10)
    expect(collapsed.size).toBeGreaterThan(0)
    expect(visibleInOrder(graph, collapsed).length).toBeLessThanOrEqual(10)
  })
})
