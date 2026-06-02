import { describe, it, expect } from 'vitest'
import { markdownToOutline, outlineToMarkdown } from './mindMapMarkdown'

describe('mind-map markdown', () => {
  it('parses frontmatter + nested bullets + per-node data', () => {
    const md = [
      '---',
      'title: T',
      '---',
      '',
      '# T',
      '',
      '- A <!-- mindmap {"id":"a","color":"#4af"} -->',
      '  - B <!-- mindmap {"id":"b"} -->',
      '- C'
    ].join('\n')
    const { title, outline } = markdownToOutline(md)
    expect(title).toBe('T')
    // implicit root: single root whose name == title -> bullets become its children
    expect(outline[0].name).toBe('T')
    expect(outline[0].children?.map((n) => n.name)).toEqual(['A', 'C'])
    expect(outline[0].children?.[0].data).toMatchObject({ id: 'a', color: '#4af' })
    expect(outline[0].children?.[0].children?.[0]).toMatchObject({ name: 'B' })
  })

  it('round-trips losslessly through markdown', () => {
    const md = '---\ntitle: T\n---\n\n# T\n\n- A <!-- mindmap {"id":"a"} -->\n'
    const { title, outline } = markdownToOutline(md)
    const again = markdownToOutline(outlineToMarkdown(outline, title))
    expect(again.outline).toEqual(outline)
  })

  it('preserves an in-name newline across a round-trip', () => {
    const outline = [{ name: 'Top', children: [{ name: 'line one\nline two' }] }]
    const again = markdownToOutline(outlineToMarkdown(outline, 'Top'))
    expect(again.outline[0].children?.[0].name).toBe('line one\nline two')
  })
})
