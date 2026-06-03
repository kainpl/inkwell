import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { outlineToYjs, yjsToOutline, replaceOutline, nodesOf } from './yjsModel'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

function seed(md: string): Y.Doc {
  const doc = new Y.Doc()
  const { outline, title } = markdownToOutline(md)
  outlineToYjs(doc, outline, title)
  return doc
}

describe('replaceOutline', () => {
  it('clears + re-seeds the doc from a new outline (rollback)', () => {
    const doc = seed('# R\n\n- A <!-- mindmap {"id":"a"} -->\n- B <!-- mindmap {"id":"b"} -->\n')
    const { outline, title } = markdownToOutline('# R2\n\n- X <!-- mindmap {"id":"x"} -->\n')
    replaceOutline(doc, outline, title)
    expect(doc.getMap('meta').get('title')).toBe('R2')
    const back = yjsToOutline(doc)
    expect(back[0].name).toBe('R2')
    expect(back[0].children?.map((c) => c.name)).toEqual(['X'])
    // old nodes gone (only R2 + X remain)
    expect(nodesOf(doc).size).toBe(2)
  })
})

describe('yjs model', () => {
  it('round-trips outline -> Y.Doc -> outline (structure, names, data)', () => {
    const md =
      '# R\n\n- A <!-- mindmap {"id":"a","color":"#4af"} -->\n  - B <!-- mindmap {"id":"b"} -->\n- C\n'
    const { outline } = markdownToOutline(md)
    const back = yjsToOutline(seed(md))
    expect(back[0].name).toBe('R')
    expect(back[0].children?.map((c) => c.name)).toEqual(outline[0].children?.map((c) => c.name))
    expect(back[0].children?.[0].data).toMatchObject({ id: 'a', color: '#4af' })
    expect(back[0].children?.[0].children?.[0].name).toBe('B')
  })

  it('keeps sibling order', () => {
    const back = yjsToOutline(seed('# R\n\n- one\n- two\n- three\n'))
    expect(back[0].children?.map((c) => c.name)).toEqual(['one', 'two', 'three'])
  })

  it('assigns a stable id to a node that lacked one', () => {
    const back = yjsToOutline(seed('# R\n\n- X\n'))
    expect(typeof back[0].children?.[0].data?.id).toBe('string')
    expect(back[0].children?.[0].data?.id).toBeTruthy()
  })
})
