import { describe, it, expect } from 'vitest'
import { resolveDrop } from './resolveDrop'
import { buildGraph } from './buildGraph'
import type { MarkdownNode } from '@shared/mindmap/types'

const outline: MarkdownNode[] = [
  {
    name: 'R',
    data: { id: 'r' },
    children: [
      { name: 'A', data: { id: 'a' } },
      { name: 'B', data: { id: 'b' } }
    ]
  }
]
const graph = buildGraph(outline)
const positions = [
  { id: 'r', x: 0, y: 0 },
  { id: 'a', x: 200, y: -30 },
  { id: 'b', x: 200, y: 30 }
]

describe('resolveDrop', () => {
  it('drop in a node’s child column → child', () => {
    expect(resolveDrop(graph, positions, 'b', { x: 330, y: -30 })).toEqual({
      kind: 'child',
      targetId: 'a'
    })
  })

  it('drop beside a sibling → reorder (index after when below)', () => {
    expect(resolveDrop(graph, positions, 'b', { x: 210, y: -10 })).toMatchObject({
      kind: 'sibling',
      parentId: 'r',
      targetId: 'a',
      index: 1,
      before: false
    })
  })

  it('drop far from everything → null', () => {
    expect(resolveDrop(graph, positions, 'b', { x: 1000, y: 1000 })).toBeNull()
  })
})
