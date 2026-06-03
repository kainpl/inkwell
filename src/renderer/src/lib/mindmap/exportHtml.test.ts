import { describe, it, expect } from 'vitest'
import { renderProjectHtml } from './exportHtml'
import { buildGraph } from './buildGraph'
import { mergeLinkTypes } from './linkTypes'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

const md =
  '# Root\n\n' +
  '- A <!-- mindmap {"id":"a","fillColor":"#abc","links":[{"id":"e1","to":"b","type":"depends-on"}]} -->\n' +
  '- B <!-- mindmap {"id":"b"} -->\n'

describe('renderProjectHtml', () => {
  it('emits self-contained HTML with nodes, cross-links, and escaped docs', () => {
    const graph = buildGraph(markdownToOutline(md).outline)
    const html = renderProjectHtml({
      title: 'My <Project>',
      graph,
      linkTypes: mergeLinkTypes(),
      docs: { a: { label: 'A', items: [{ title: 'Note', content: 'hi <b> & bye' }] } }
    })
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('My &lt;Project&gt;') // title escaped
    expect(html).toContain('Root')
    expect(html).toContain('A')
    expect(html).toContain('depends on') // cross-link type label
    expect(html).toContain('hi &lt;b&gt; &amp; bye') // doc content escaped
    expect(html).toContain('#abc') // node fill color
    expect(html).not.toContain('<script') // no scripts (self-contained, safe)
  })

  it('inlines bundled assets/ images as <img> and leaves unknown refs as text', () => {
    const graph = buildGraph(markdownToOutline(md).outline)
    const html = renderProjectHtml({
      title: 'T',
      graph,
      linkTypes: mergeLinkTypes(),
      docs: { a: { label: 'A', items: [{ title: 'D', content: '![pic](assets/x.png) ![y](assets/missing.png)' }] } },
      assets: { 'assets/x.png': 'data:image/png;base64,AAAA' }
    })
    expect(html).toContain('<img src="data:image/png;base64,AAAA"')
    expect(html).toContain('![y](assets/missing.png)') // unbundled ref stays literal
  })

  it('renders doc bodies as HTML (.ink-doc) when a renderMd is supplied, inlining assets', () => {
    const graph = buildGraph(markdownToOutline(md).outline)
    const renderMd = (m: string): string =>
      m.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/!\[[^\]]*\]\(([^)]+)\)/g, '<img src="$1">')
    const html = renderProjectHtml({
      title: 'T',
      graph,
      linkTypes: mergeLinkTypes(),
      docs: { a: { label: 'A', items: [{ title: 'D', content: '**bold** ![p](assets/x.png)' }] } },
      assets: { 'assets/x.png': 'data:image/png;base64,AAAA' },
      renderMd
    })
    expect(html).toContain('<div class="ink-doc">')
    expect(html).toContain('<strong>bold</strong>') // markdown rendered, not escaped
    expect(html).toContain('<img src="data:image/png;base64,AAAA">') // asset inlined via src
    expect(html).not.toContain('<pre>**bold**') // not the escaped fallback
  })
})
