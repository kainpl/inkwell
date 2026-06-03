// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { importAny, splitSubtitle } from './importFormats'

describe('importAny', () => {
  it('parses .mind-doc as our native format (alias of .mind-map)', () => {
    const md = '# Root\n\n- A <!-- mindmap {"id":"a"} -->\n  - A1\n- B\n'
    const r = importAny('notes.mind-doc', md)
    expect(r.title).toBe('Root')
    expect(r.outline[0].children?.map((n) => n.name)).toEqual(['A', 'B'])
  })

  it('parses FreeMind .mm (nesting + color)', () => {
    const mm =
      '<map version="1.0.1"><node TEXT="Root">' +
      '<node TEXT="Child" COLOR="#ff0000"><node TEXT="Leaf"/></node>' +
      '<node TEXT="Other"/></node></map>'
    const r = importAny('map.mm', mm)
    expect(r.title).toBe('Root')
    const kids = r.outline[0].children ?? []
    expect(kids.map((n) => n.name)).toEqual(['Child', 'Other'])
    expect(kids[0].data?.color).toBe('#ff0000')
    expect(kids[0].data?.expand).toBe(false) // depth≥1 with children → collapsed
  })

  it('parses OPML', () => {
    const opml =
      '<opml><head><title>My Map</title></head><body>' +
      '<outline text="Top"><outline text="Sub"/></outline></body></opml>'
    const r = importAny('x.opml', opml)
    expect(r.title).toBe('My Map')
    expect(r.outline[0].name).toBe('Top')
    expect(r.outline[0].children?.[0].name).toBe('Sub')
  })

  it('parses indented .txt', () => {
    const r = importAny('o.txt', 'Title\n  A\n    A1\n  B\n')
    expect(r.title).toBe('Title')
    expect(r.outline.map((n) => n.name)).toEqual(['A', 'B'])
    expect(r.outline[0].children?.[0].name).toBe('A1')
  })

  it('parses JSON {title, outline}', () => {
    const json = JSON.stringify({ title: 'J', outline: [{ name: 'N', children: [{ name: 'M' }] }] })
    const r = importAny('m.json', json)
    expect(r.title).toBe('J')
    expect(r.outline[0].name).toBe('N')
    expect(r.outline[0].children?.[0].name).toBe('M')
  })
})

describe('splitSubtitle', () => {
  it('moves the rest of a multi-line name into data.note (recursive)', () => {
    const r = splitSubtitle([{ name: 'Title\nSub line', children: [{ name: 'Child\nc-sub' }] }])
    expect(r[0].name).toBe('Title')
    expect(r[0].data?.note).toBe('Sub line')
    expect(r[0].children?.[0].name).toBe('Child')
    expect(r[0].children?.[0].data?.note).toBe('c-sub')
  })
  it('preserves an existing note', () => {
    const r = splitSubtitle([{ name: 'T\nS', data: { note: 'old' } }])
    expect(r[0].data?.note).toBe('S\nold')
  })
  it('leaves single-line names untouched', () => {
    const r = splitSubtitle([{ name: 'Just one' }])
    expect(r[0].name).toBe('Just one')
    expect(r[0].data).toBeUndefined()
  })
})
