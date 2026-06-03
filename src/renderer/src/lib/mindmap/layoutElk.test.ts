import { describe, it, expect } from 'vitest'
import type { ElkNode } from 'elkjs/lib/elk.bundled.js'
import { toElkGraph, fromElkGraph, elkOptions, computeElkLayout } from './layoutElk'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

const md =
  '# R <!-- mindmap {"id":"r"} -->\n\n' +
  '- A <!-- mindmap {"id":"a"} -->\n' +
  '  - A1 <!-- mindmap {"id":"a1"} -->\n' +
  '- B <!-- mindmap {"id":"b"} -->\n'
const graph = (): ReturnType<typeof buildGraph> => buildGraph(markdownToOutline(md).outline)

describe('toElkGraph / fromElkGraph (pure)', () => {
  it('builds ELK input from the visible tree (tree edges only)', () => {
    const g = toElkGraph(graph(), new Set(), 'right')
    expect(g.children?.map((c) => c.id).sort()).toEqual(['a', 'a1', 'b', 'r'])
    expect(g.edges?.length).toBe(3) // r→a, a→a1, r→b
    expect(g.layoutOptions?.['elk.algorithm']).toBe('org.eclipse.elk.mrtree')
    expect(g.layoutOptions?.['elk.direction']).toBe('RIGHT')
  })

  it('excludes collapsed descendants (and their edges)', () => {
    const g = toElkGraph(graph(), new Set(['a']), 'right') // collapse 'a' → 'a1' hidden
    expect(g.children?.map((c) => c.id).sort()).toEqual(['a', 'b', 'r'])
    expect(g.edges?.length).toBe(2) // a→a1 dropped
  })

  it('radial uses the radial algorithm; down sets DOWN', () => {
    expect(elkOptions('radial')['elk.algorithm']).toBe('org.eclipse.elk.radial')
    expect(elkOptions('down')['elk.direction']).toBe('DOWN')
  })

  it('fromElkGraph maps x/y', () => {
    const r: ElkNode = { id: 'root', children: [{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 30, y: 40 }] }
    const pos = fromElkGraph(r)
    expect(pos.get('a')).toEqual({ x: 10, y: 20 })
    expect(pos.get('b')).toEqual({ x: 30, y: 40 })
  })
})

describe('computeElkLayout (real ELK)', () => {
  it('produces finite, distinct positions', async () => {
    const pos = await computeElkLayout(graph(), new Set(), 'right')
    for (const id of ['r', 'a', 'a1', 'b']) {
      const p = pos.get(id)
      expect(p && Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
    }
    const keys = ['r', 'a', 'b'].map((id) => `${pos.get(id)!.x},${pos.get(id)!.y}`)
    expect(new Set(keys).size).toBe(3)
  }, 20000)

  it('honors a manual pin', async () => {
    const g = buildGraph(
      markdownToOutline(
        '# R <!-- mindmap {"id":"r"} -->\n\n- A <!-- mindmap {"id":"a","customLeft":777,"customTop":888} -->\n'
      ).outline
    )
    const pos = await computeElkLayout(g, new Set(), 'right')
    expect(pos.get('a')).toEqual({ x: 777, y: 888 })
  }, 20000)
})
