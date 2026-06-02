import { describe, it, expect } from 'vitest'
import { computeLayout } from './layout'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

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
})
