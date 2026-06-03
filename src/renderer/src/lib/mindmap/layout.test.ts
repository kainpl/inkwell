import { describe, it, expect } from 'vitest'
import { computeLayout, subtreeBounds, NODE_W, NODE_H } from './layout'
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

  it('treats collapsed nodes as leaves (hidden subtrees reserve no space)', () => {
    const kids = (id: string, n: number): MarkdownNode => ({
      name: id,
      data: { id },
      children: Array.from({ length: n }, (_, i) => ({ name: `${id}${i}`, data: { id: `${id}${i}` } }))
    })
    // Two siblings that both carry subtrees → their subtrees push them apart.
    const graph = buildGraph([{ name: 'R', data: { id: 'r' }, children: [kids('a', 8), kids('b', 8)] }])
    const gap = (pos: Map<string, { x: number; y: number }>): number =>
      Math.abs((pos.get('b')?.y ?? 0) - (pos.get('a')?.y ?? 0))
    const expanded = gap(computeLayout(graph))
    const collapsed = gap(computeLayout(graph, new Set(['a', 'b'])))
    expect(collapsed).toBeLessThan(expanded) // collapsing both packs them together
    expect(collapsed).toBeLessThan(80) // now adjacent siblings (~NODE_SEP apart)
  })

  it('an expanded subtree brackets its leaf siblings (banded, no interleave)', () => {
    const leaf = (id: string): MarkdownNode => ({ name: id, data: { id } })
    const graph = buildGraph([
      {
        name: 'R',
        data: { id: 'r' },
        children: [
          leaf('above'),
          { name: 'S', data: { id: 's' }, children: [leaf('s1'), leaf('s2'), leaf('s3')] },
          leaf('below')
        ]
      }
    ])
    const pos = computeLayout(graph)
    const y = (id: string): number => pos.get(id)?.y ?? NaN
    // 'above' sits above ALL of S's children; 'below' sits below all of them.
    expect(y('above')).toBeLessThan(Math.min(y('s1'), y('s2'), y('s3')))
    expect(y('below')).toBeGreaterThan(Math.max(y('s1'), y('s2'), y('s3')))
  })

  it('subtreeBounds covers a node + its visible descendants (shrinks when collapsed)', () => {
    const leaf = (id: string): MarkdownNode => ({ name: id, data: { id } })
    const graph = buildGraph([
      { name: 'R', data: { id: 'r' }, children: [{ name: 'S', data: { id: 's' }, children: [leaf('s1'), leaf('s2')] }] }
    ])
    const layout = computeLayout(graph)
    const b = subtreeBounds(graph, new Set(), layout, 's')
    expect(b).not.toBeNull()
    // spans from S's column to its children's column, and across both child rows
    const ys = ['s', 's1', 's2'].map((id) => layout.get(id)!.y)
    expect(b!.x).toBe(layout.get('s')!.x)
    expect(b!.w).toBeGreaterThan(NODE_W) // includes the deeper child column
    expect(b!.h).toBeCloseTo(Math.max(...ys) + NODE_H - Math.min(...ys))

    // Collapsing S → only S itself is in bounds (its hidden children reserve nothing).
    const collapsedLayout = computeLayout(graph, new Set(['s']))
    const cb = subtreeBounds(graph, new Set(['s']), collapsedLayout, 's')
    expect(cb).toEqual({ x: collapsedLayout.get('s')!.x, y: collapsedLayout.get('s')!.y, w: NODE_W, h: NODE_H })
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
