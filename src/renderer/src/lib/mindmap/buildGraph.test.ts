import { describe, it, expect } from 'vitest'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

describe('buildGraph', () => {
  it('flattens tree, builds typed cross edges + reverse index', () => {
    const md =
      '# R\n\n' +
      '- A <!-- mindmap {"id":"a","links":[{"id":"e1","to":"b","type":"depends-on"}]} -->\n' +
      '- B <!-- mindmap {"id":"b"} -->\n'
    const { outline } = markdownToOutline(md)
    const g = buildGraph(outline)

    expect(g.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b']))
    const cross = g.edges.filter((e) => e.kind === 'cross')
    expect(cross).toEqual([
      expect.objectContaining({ id: 'e1', linkId: 'e1', source: 'a', target: 'b', type: 'depends-on' })
    ])
    expect(g.incomingCross.get('b')?.[0]?.source).toBe('a')

    const root = g.nodes.find((n) => n.label === 'R')
    expect(g.childrenOf.get(root?.id ?? '')).toEqual(['a', 'b'])
  })

  it('derives a stable id when missing, and warns on a dangling cross-link', () => {
    const warnings: string[] = []
    const md = '# R\n\n- X <!-- mindmap {"id":"x","links":[{"id":"e","to":"ghost","type":"blocks"}]} -->\n'
    const { outline } = markdownToOutline(md)
    const g = buildGraph(outline, { onWarn: (m) => warnings.push(m) })
    expect(g.nodes.find((n) => n.label === 'R')?.id).toBeTruthy() // derived
    expect(g.edges.some((e) => e.kind === 'cross')).toBe(false) // dangling dropped
    expect(warnings.some((w) => w.includes('ghost'))).toBe(true)
  })
})
