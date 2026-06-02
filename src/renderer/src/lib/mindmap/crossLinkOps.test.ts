import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { outlineToYjs, yjsToOutline } from './yjsModel'
import { addCrossLink, updateCrossLink, removeCrossLink } from './crossLinkOps'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import type { CrossLink, MarkdownNode } from '@shared/mindmap/types'

function seed(md: string): Y.Doc {
  const doc = new Y.Doc()
  const { outline, title } = markdownToOutline(md)
  outlineToYjs(doc, outline, title)
  return doc
}
const linksOf = (doc: Y.Doc, id: string): CrossLink[] => {
  const find = (nodes: MarkdownNode[] = []): MarkdownNode | undefined => {
    for (const n of nodes) {
      if (n.data?.id === id) return n
      const f = find(n.children)
      if (f) return f
    }
    return undefined
  }
  return find(yjsToOutline(doc))?.data?.links ?? []
}

const AB = '# R\n\n- A <!-- mindmap {"id":"a"} -->\n- B <!-- mindmap {"id":"b"} -->\n'

describe('cross-link edit ops', () => {
  it('addCrossLink appends a typed link on the source node', () => {
    const doc = seed(AB)
    const id = addCrossLink(doc, 'a', 'b')
    expect(typeof id).toBe('string')
    expect(linksOf(doc, 'a')).toEqual([{ id, to: 'b', type: 'relates-to', label: undefined }])
  })

  it('rejects a self-link', () => {
    const doc = seed(AB)
    expect(addCrossLink(doc, 'a', 'a')).toBeNull()
    expect(linksOf(doc, 'a')).toEqual([])
  })

  it('updateCrossLink patches type and label', () => {
    const doc = seed(AB)
    const id = addCrossLink(doc, 'a', 'b') as string
    updateCrossLink(doc, 'a', id, { type: 'blocks', label: 'why' })
    expect(linksOf(doc, 'a')[0]).toMatchObject({ type: 'blocks', label: 'why', to: 'b' })
  })

  it('removeCrossLink drops the link', () => {
    const doc = seed(AB)
    const id = addCrossLink(doc, 'a', 'b') as string
    removeCrossLink(doc, 'a', id)
    expect(linksOf(doc, 'a')).toEqual([])
  })

  it('preserves other links when adding/removing', () => {
    const doc = seed(AB)
    const e1 = addCrossLink(doc, 'a', 'b', 'depends-on') as string
    const e2 = addCrossLink(doc, 'a', 'b', 'references') as string
    removeCrossLink(doc, 'a', e1)
    expect(linksOf(doc, 'a').map((l) => l.id)).toEqual([e2])
  })
})
