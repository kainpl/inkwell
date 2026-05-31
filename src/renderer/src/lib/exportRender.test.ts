import { renderMarkdownBody, renderDocumentHtml, renderPlainText } from './exportRender'

describe('renderMarkdownBody', () => {
  it('renders headings, emphasis and inline code', () => {
    const html = renderMarkdownBody('# Title\n\n**bold** *em* `code`')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<code>code</code>')
  })

  it('renders GFM tables and strikethrough', () => {
    const html = renderMarkdownBody('| A | B |\n| - | - |\n| 1 | 2 |\n\n~~gone~~')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>A</th>')
    expect(html).toContain('<s>gone</s>')
  })

  it('renders task lists with checkboxes', () => {
    const html = renderMarkdownBody('- [x] done\n- [ ] todo')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })

  it('renders footnotes', () => {
    const html = renderMarkdownBody('text[^1]\n\n[^1]: a note')
    expect(html).toContain('footnote')
  })

  it('renders highlight, sub and sup', () => {
    const html = renderMarkdownBody('==hi== H~2~O x^2^')
    expect(html).toContain('<mark>hi</mark>')
    expect(html).toContain('<sub>2</sub>')
    expect(html).toContain('<sup>2</sup>')
  })

  it('strips scripts and event handlers from the output (XSS-safe)', () => {
    const html = renderMarkdownBody(
      'ok\n\n<script>alert(1)</script>\n\nimg <img src=x onerror="alert(1)">'
    )
    expect(html.toLowerCase()).not.toContain('<script')
    expect(html.toLowerCase()).not.toContain('onerror')
    expect(html).toContain('ok')
  })

  it('keeps safe inline raw HTML like <u>', () => {
    expect(renderMarkdownBody('<u>under</u>')).toContain('<u>under</u>')
  })

  it('renders inline and block math with KaTeX', () => {
    const html = renderMarkdownBody('inline $E=mc^2$\n\n$$\n\\int_0^1 x\\,dx\n$$')
    expect(html).toContain('katex')
    // KaTeX emits the source in an annotation, proving it rendered (not raw $).
    expect(html).not.toContain('$E=mc^2$')
  })

  it('renders :shortcode: emoji', () => {
    expect(renderMarkdownBody('hi :rocket:')).toContain('🚀')
  })
})

describe('renderPlainText', () => {
  it('strips markdown markers and puts blocks on their own lines', () => {
    const text = renderPlainText('# Title\n\nSome **bold** text.\n\n- a\n- b')
    expect(text).toContain('Title')
    expect(text).toContain('Some bold text.')
    expect(text).not.toContain('#')
    expect(text).not.toContain('**')
    expect(text.split('\n').filter((l) => l.trim()).length).toBeGreaterThanOrEqual(4)
  })
})

describe('renderDocumentHtml', () => {
  it('wraps the body in a full HTML document, with styles by default', async () => {
    const html = await renderDocumentHtml('# Hi')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<style>')
    expect(html).toContain('<h1>Hi</h1>')
  })

  it('omits styles when styled is false', async () => {
    const html = await renderDocumentHtml('# Hi', { styled: false })
    expect(html).not.toContain('<style>')
    expect(html).toContain('<h1>Hi</h1>')
  })

  it('converts GitHub alerts into styled blockquotes', async () => {
    const html = await renderDocumentHtml('> [!NOTE]\n> careful')
    expect(html).toContain('ink-alert-note')
    expect(html).toContain('ink-alert-label')
    expect(html).not.toContain('[!NOTE]')
  })

  it('expands [toc] into a table of contents from headings', async () => {
    const html = await renderDocumentHtml('# One\n\n[toc]\n\n## Two')
    expect(html).toContain('ink-toc')
    expect(html).toContain('href="#two"')
  })

  it('renders mermaid blocks via the injected renderer', async () => {
    const html = await renderDocumentHtml('```mermaid\ngraph LR\nA-->B\n```', {
      renderMermaidSvg: async () => '<svg id="m"></svg>'
    })
    expect(html).toContain('ink-mermaid')
    expect(html).toContain('<svg')
    expect(html).not.toContain('language-mermaid')
  })

  it('embeds local images via the injected embedder', async () => {
    const html = await renderDocumentHtml('![a](pic.png)', {
      docPath: '/docs/note.md',
      embedImage: async () => 'data:image/png;base64,AAAA'
    })
    expect(html).toContain('data:image/png;base64,AAAA')
  })
})
