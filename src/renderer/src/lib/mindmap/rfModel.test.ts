import { describe, it, expect } from 'vitest'
import { buildRfModel } from './rfModel'
import { buildGraph } from './buildGraph'
import { computeLayout } from './layout'
import { mergeLinkTypes } from './linkTypes'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

function fixture(): {
  graph: ReturnType<typeof buildGraph>
  layout: ReturnType<typeof computeLayout>
  reg: ReturnType<typeof mergeLinkTypes>
} {
  const md =
    '# R\n\n' +
    '- A <!-- mindmap {"id":"a","links":[{"id":"e1","to":"b","type":"depends-on"}]} -->\n' +
    '  - A1 <!-- mindmap {"id":"a1"} -->\n' +
    '- B <!-- mindmap {"id":"b"} -->\n'
  const graph = buildGraph(markdownToOutline(md).outline)
  return { graph, layout: computeLayout(graph), reg: mergeLinkTypes() }
}

describe('buildRfModel', () => {
  it('emits mind nodes + tree and crosslink edges with resolved link type', () => {
    const { graph, layout, reg } = fixture()
    const m = buildRfModel(graph, layout, new Set(), reg)
    expect(m.nodes.every((n) => n.type === 'mind')).toBe(true)
    expect(m.edges.some((e) => e.type === 'tree')).toBe(true)
    const cross = m.edges.find((e) => e.type === 'crosslink')
    expect(cross?.data?.linkType?.color).toBe(reg['depends-on'].color)
  })

  it('hides descendants of a collapsed node (and their edges)', () => {
    const { graph, layout, reg } = fixture()
    const m = buildRfModel(graph, layout, new Set(['a']), reg)
    expect(m.nodes.find((n) => n.id === 'a1')).toBeUndefined() // hidden child
    expect(m.nodes.find((n) => n.id === 'a')).toBeDefined() // collapsed node visible
    expect(m.edges.find((e) => e.target === 'a1')).toBeUndefined() // edge dropped
  })
})
