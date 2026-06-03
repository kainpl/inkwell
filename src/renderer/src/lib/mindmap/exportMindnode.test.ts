import { describe, it, expect } from 'vitest'
import { outlineToMindnodeContents } from './exportMindnode'
import { mindnodeContentsToOutline } from './importMindnode'
import type { MarkdownNode } from '@shared/mindmap/types'

describe('outlineToMindnodeContents (writer)', () => {
  it('round-trips an outline through our own reader (names + structure)', () => {
    const outline: MarkdownNode[] = [
      { name: 'Root', children: [{ name: 'A', children: [{ name: 'A1' }] }, { name: 'B' }] }
    ]
    const r = mindnodeContentsToOutline(outlineToMindnodeContents('Root', outline))
    expect(r.title).toBe('Root')
    const kids = r.outline[0].children ?? []
    expect(kids.map((n) => n.name)).toEqual(['A', 'B'])
    expect(kids[0].children?.[0].name).toBe('A1')
  })

  it('synthesises a root from the title when given a forest', () => {
    const r = mindnodeContentsToOutline(
      outlineToMindnodeContents('My Map', [{ name: 'One' }, { name: 'Two' }])
    )
    expect(r.outline[0].name).toBe('My Map')
    expect(r.outline[0].children?.map((n) => n.name)).toEqual(['One', 'Two'])
  })

  it('preserves unicode titles', () => {
    const r = mindnodeContentsToOutline(
      outlineToMindnodeContents('Корінь', [{ name: 'Корінь', children: [{ name: 'Гілка ✓' }] }])
    )
    expect(r.outline[0].children?.[0].name).toBe('Гілка ✓')
  })
})
