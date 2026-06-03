import { describe, it, expect } from 'vitest'
import { computeLayout } from './layout'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import type { MarkdownNode } from '@shared/mindmap/types'

const graphOf = (md: string) => buildGraph(markdownToOutline(md).outline)

describe('computeLayout', () => {
  it('places two children on the same depth axis, distinct cross axis', () => {
    const g = graphOf('# R\n\n- A <!-- mindmap {"id":"a"} -->\n- B <!-- mindmap {"id":"b"} -->\n')
    const pos = computeLayout(g)
    const a = pos.get('a')
    const b = pos.get('b')
    expect(a?.x).toBe(b?.x) // same depth (x)
    expect(a?.y).not.toBe(b?.y) // distinct cross-axis (y)
  })

  it('honors an absolute pin (customLeft/customTop)', () => {
    const g = graphOf('# R\n\n- A <!-- mindmap {"id":"a","customLeft":111,"customTop":222} -->\n')
    expect(computeLayout(g).get('a')).toEqual({ x: 111, y: 222 })
  })

  it('honors a delta pin (offsetX)', () => {
    const base = computeLayout(graphOf('# R\n\n- A <!-- mindmap {"id":"a"} -->\n')).get('a')
    const pinned = computeLayout(graphOf('# R\n\n- A <!-- mindmap {"id":"a","offsetX":10} -->\n')).get('a')
    expect(pinned?.x).toBe((base?.x ?? 0) + 10)
  })

  it('stacks multiple roots without overlap (first root unchanged)', () => {
    const kid = (id: string): MarkdownNode => ({ name: id, data: { id } })
    const outline: MarkdownNode[] = [
      { name: 'R1', data: { id: 'r1' }, children: [kid('a'), kid('b')] },
      { name: 'R2', data: { id: 'r2' }, children: [kid('c'), kid('d')] }
    ]
    const pos = computeLayout(buildGraph(outline))
    const y = (id: string): number => pos.get(id)?.y ?? NaN
    const maxY1 = Math.max(y('r1'), y('a'), y('b'))
    const minY2 = Math.min(y('r2'), y('c'), y('d'))
    expect(maxY1).toBeLessThan(minY2) // root subtrees disjoint on the cross-axis

    // First root's positions match a single-root layout (offset 0).
    const solo = computeLayout(buildGraph([outline[0]]))
    expect(y('a')).toBe(solo.get('a')?.y)
    expect(y('b')).toBe(solo.get('b')?.y)
  })
})
