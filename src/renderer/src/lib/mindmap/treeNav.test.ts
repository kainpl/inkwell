import { describe, it, expect } from 'vitest'
import { searchNodes, ancestorsOf } from './treeNav'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

const graph = buildGraph(
  markdownToOutline(
    '# Root\n\n- Alpha <!-- mindmap {"id":"a"} -->\n  - Beta <!-- mindmap {"id":"b"} -->\n- Gamma <!-- mindmap {"id":"g"} -->\n'
  ).outline
)
const rootId = graph.nodes.find((n) => n.parentId === null)?.id ?? ''

describe('treeNav', () => {
  it('searchNodes matches labels case-insensitively', () => {
    expect(searchNodes(graph, 'alph')).toEqual(['a'])
    expect(searchNodes(graph, 'A')).toEqual(['a', 'b', 'g']) // Alpha, Beta, Gamma all contain "a"
    expect(searchNodes(graph, '')).toEqual([])
  })

  it('ancestorsOf returns root → parent', () => {
    expect(ancestorsOf(graph, 'b')).toEqual([rootId, 'a'])
    expect(ancestorsOf(graph, 'a')).toEqual([rootId])
    expect(ancestorsOf(graph, rootId)).toEqual([])
  })
})
