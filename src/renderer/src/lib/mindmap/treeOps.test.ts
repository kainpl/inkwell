import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { outlineToYjs, yjsToOutline, nodesOf } from './yjsModel'
import { addChild, addSibling, rename, remove, reparent, reorder, insertOutlineUnder } from './treeOps'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import type { MarkdownNode } from '@shared/mindmap/types'

function seed(md: string): Y.Doc {
  const doc = new Y.Doc()
  const { outline, title } = markdownToOutline(md)
  outlineToYjs(doc, outline, title)
  return doc
}
// helper: names of the children of the node with a given data.id
const childNames = (doc: Y.Doc, id: string): string[] => {
  const find = (nodes: MarkdownNode[] = []): MarkdownNode | undefined => {
    for (const n of nodes) {
      if (n.data?.id === id) return n
      const f = find(n.children)
      if (f) return f
    }
    return undefined
  }
  return find(yjsToOutline(doc))?.children?.map((c) => c.name) ?? []
}

describe('insertOutlineUnder', () => {
  it('merges an imported outline under a node (recursive, fresh ids)', () => {
    const doc = seed('# R\n\n- A <!-- mindmap {"id":"a"} -->\n')
    const top = insertOutlineUnder(doc, 'a', [
      { name: 'X', children: [{ name: 'X1' }] },
      { name: 'Y' }
    ])
    expect(top).toHaveLength(2)
    expect(childNames(doc, 'a')).toEqual(['X', 'Y'])
    // fresh ids (not the imported ones) so the new 'X' node carries a minted id
    const xId = nodesOf(doc).get(top[0])
    expect(xId?.get('name')).toBe('X')
    // child X1 is nested under X
    const xOutline = yjsToOutline(doc)
    const findX = (ns: MarkdownNode[]): MarkdownNode | undefined => {
      for (const n of ns) {
        if (n.name === 'X') return n
        const f = n.children ? findX(n.children) : undefined
        if (f) return f
      }
      return undefined
    }
    expect(findX(xOutline)?.children?.map((c) => c.name)).toEqual(['X1'])
  })
})

describe('tree edit ops', () => {
  it('addChild appends a child under a node', () => {
    const doc = seed('# R\n\n- A <!-- mindmap {"id":"a"} -->\n')
    const id = addChild(doc, 'a')
    rename(doc, id, 'child')
    expect(childNames(doc, 'a')).toEqual(['child'])
  })

  it('addSibling inserts under the same parent', () => {
    const doc = seed('# R\n\n- A <!-- mindmap {"id":"a"} -->\n- B <!-- mindmap {"id":"b"} -->\n')
    rename(doc, addSibling(doc, 'a'), 'sib')
    const roots = yjsToOutline(doc)[0].children?.map((c) => c.name)
    expect(roots).toContain('sib')
    expect(roots?.length).toBe(3)
  })

  it('remove deletes the subtree and strips cross-links pointing at it', () => {
    const doc = seed(
      '# R\n\n- A <!-- mindmap {"id":"a"} -->\n  - A1 <!-- mindmap {"id":"a1"} -->\n' +
        '- B <!-- mindmap {"id":"b","links":[{"id":"e","to":"a1","type":"depends-on"}]} -->\n'
    )
    remove(doc, 'a')
    const outline = yjsToOutline(doc)
    const names = outline[0].children?.map((c) => c.name)
    expect(names).toEqual(['B'])
    const b = outline[0].children?.find((c) => c.data?.id === 'b')
    expect(b?.data?.links ?? []).toEqual([]) // dangling link stripped
  })

  it('reorder repositions a node among its siblings (orders normalize)', () => {
    const doc = seed(
      '# R\n\n- A <!-- mindmap {"id":"a"} -->\n- B <!-- mindmap {"id":"b"} -->\n- C <!-- mindmap {"id":"c"} -->\n'
    )
    const parent = nodesOf(doc).get('a')?.get('parentId') as string
    expect(reorder(doc, 'c', parent, 0)).toBe(true)
    expect(childNames(doc, parent)).toEqual(['C', 'A', 'B'])
    reorder(doc, 'c', parent, 2)
    expect(childNames(doc, parent)).toEqual(['A', 'B', 'C'])
  })

  it('reparent moves a node, and rejects a cycle', () => {
    const doc = seed(
      '# R\n\n- A <!-- mindmap {"id":"a"} -->\n  - A1 <!-- mindmap {"id":"a1"} -->\n- B <!-- mindmap {"id":"b"} -->\n'
    )
    expect(reparent(doc, 'b', 'a')).toBe(true)
    expect(childNames(doc, 'a')).toContain('B')
    expect(reparent(doc, 'a', 'a1')).toBe(false) // a1 is a descendant of a -> cycle
  })
})
