import { describe, it, expect } from 'vitest'
import { projectDocs, nodesReferencing } from './projectDocs'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

const md =
  '# R\n\n' +
  '- A <!-- mindmap {"id":"a","docs":[{"path":"docs/shared.md","title":"Shared"}]} -->\n' +
  '- B <!-- mindmap {"id":"b","docs":[{"path":"docs/shared.md","title":"Shared"},{"path":"docs/b.md","title":"B"}]} -->\n' +
  '- C <!-- mindmap {"id":"c","docs":[{"external":true,"src":"/x.md","title":"Ext"}]} -->\n'

const graph = (): ReturnType<typeof buildGraph> => buildGraph(markdownToOutline(md).outline)

describe('projectDocs', () => {
  it('aggregates internal docs (deduped by path) with their referencing nodes', () => {
    const docs = projectDocs(graph())
    expect(docs.map((d) => d.path)).toEqual(['docs/b.md', 'docs/shared.md']) // sorted by title (B < Shared)
    const shared = docs.find((d) => d.path === 'docs/shared.md')!
    expect(shared.nodeIds).toEqual(['a', 'b']) // M:N — one doc, two nodes
    expect(docs.find((d) => d.path === 'docs/b.md')!.nodeIds).toEqual(['b'])
  })

  it('excludes external refs', () => {
    expect(projectDocs(graph()).some((d) => d.title === 'Ext')).toBe(false)
  })

  it('nodesReferencing lists every node attached to a path', () => {
    expect(nodesReferencing(graph(), 'docs/shared.md')).toEqual(['a', 'b'])
    expect(nodesReferencing(graph(), 'docs/b.md')).toEqual(['b'])
    expect(nodesReferencing(graph(), 'docs/none.md')).toEqual([])
  })
})
