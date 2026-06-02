import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { outlineToYjs } from './yjsModel'
import { nodeDocs, pushDocRef, removeDocRef } from './docOps'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

function seed(): Y.Doc {
  const doc = new Y.Doc()
  const { outline, title } = markdownToOutline('# R\n\n- A <!-- mindmap {"id":"a"} -->\n')
  outlineToYjs(doc, outline, title)
  return doc
}

describe('doc ref ops', () => {
  it('pushes, lists, and removes doc refs on a node', () => {
    const doc = seed()
    expect(nodeDocs(doc, 'a')).toEqual([])
    pushDocRef(doc, 'a', { path: 'docs/x.md', title: 'X' })
    pushDocRef(doc, 'a', { path: 'docs/y.md', title: 'Y' })
    expect(nodeDocs(doc, 'a').map((r) => r.path)).toEqual(['docs/x.md', 'docs/y.md'])
    removeDocRef(doc, 'a', 0)
    expect(nodeDocs(doc, 'a').map((r) => r.path)).toEqual(['docs/y.md'])
  })
})
