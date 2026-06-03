import { describe, it, expect } from 'vitest'
import { searchNodes, ancestorsOf, navigate, expandToLevel, focusSet } from './treeNav'
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

  it('navigate moves up/down/left/right', () => {
    expect(navigate(graph, 'a', 'down')).toBe('g') // next sibling
    expect(navigate(graph, 'g', 'up')).toBe('a') // prev sibling
    expect(navigate(graph, 'a', 'right')).toBe('b') // first child
    expect(navigate(graph, 'b', 'left')).toBe('a') // parent
    expect(navigate(graph, 'a', 'up')).toBeNull() // no prev sibling
    expect(navigate(graph, 'g', 'right')).toBeNull() // no children
  })

  it('focusSet = node + ancestors + descendants', () => {
    // Alpha 'a' (child of root) with child Beta 'b'.
    expect(focusSet(graph, 'a')).toEqual(new Set([rootId, 'a', 'b']))
    expect(focusSet(graph, 'g')).toEqual(new Set([rootId, 'g'])) // leaf → self + root
  })

  it('expandToLevel collapses below the given depth', () => {
    const c1 = expandToLevel(graph, 1) // show root + its children, hide deeper
    expect(c1.has('a')).toBe(true) // Alpha (depth 1) has a child → collapsed
    expect(c1.has(rootId)).toBe(false) // root visible
    const c2 = expandToLevel(graph, 2)
    expect(c2.has('a')).toBe(false) // depth 1 now expanded
  })
})
