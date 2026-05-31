import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { Subscript, Superscript } from '@lezer/markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import type { Decoration } from '@codemirror/view'
import {
  buildDecorations,
  BulletWidget,
  TaskCheckboxWidget,
  HrWidget,
  EmojiWidget,
  ImageWidget,
  CodeBadgeWidget,
  MathWidget,
  MermaidWidget,
  AlertLabelWidget,
  FootnoteRefWidget,
  TocWidget,
  HtmlBlockWidget,
  TableWidget,
  resolveImageSrc,
  linkUrlAt,
  headingOffset
} from './livePreview'

interface DecoItem {
  from: number
  to: number
  spec: Decoration['spec']
}

/** Build decorations for a doc with the given active (1-based) line numbers. */
function decorate(doc: string, active: number[] = []): DecoItem[] {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage, extensions: [Subscript, Superscript] })]
  })
  // Force a full synchronous parse so syntaxTree() is complete headlessly.
  ensureSyntaxTree(state, state.doc.length, 5000)

  const set = buildDecorations(state, [{ from: 0, to: state.doc.length }], new Set(active))
  const items: DecoItem[] = []
  const cursor = set.iter()
  while (cursor.value) {
    items.push({ from: cursor.from, to: cursor.to, spec: cursor.value.spec })
    cursor.next()
  }
  return items
}

function bullets(items: DecoItem[]): BulletWidget[] {
  return items
    .map((i) => i.spec.widget)
    .filter((w): w is BulletWidget => w instanceof BulletWidget)
}

/** A fully-parsed EditorState for link-resolution tests. */
function parsed(doc: string): EditorState {
  const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage, extensions: [Subscript, Superscript] })] })
  ensureSyntaxTree(state, state.doc.length, 5000)
  return state
}

describe('buildDecorations — lists', () => {
  it('renders a bullet widget for an unordered item on an inactive line', () => {
    const found = bullets(decorate('- milk'))
    expect(found).toHaveLength(1)
    expect(found[0].glyph).toBe('•')
  })

  it('uses depth-aware glyphs for nested unordered lists', () => {
    const glyphs = bullets(decorate('- a\n  - b\n    - c')).map((w) => w.glyph)
    expect(glyphs).toEqual(['•', '◦', '▪'])
  })

  it('keeps ordered numbers visible (styled, not replaced by a widget)', () => {
    const items = decorate('1. first\n2. second')
    expect(bullets(items)).toHaveLength(0)
    expect(items.filter((i) => i.spec.class === 'ink-list-number')).toHaveLength(2)
  })

  it('shows the raw marker (dimmed) on the active line', () => {
    const items = decorate('- milk', [1])
    expect(bullets(items)).toHaveLength(0)
    expect(items.some((i) => i.spec.class === 'ink-mark')).toBe(true)
  })

  it('tags list lines with the hanging-indent class', () => {
    expect(decorate('- milk').some((i) => i.spec.class === 'ink-li')).toBe(true)
  })
})

describe('buildDecorations — blockquotes', () => {
  it('styles every line of a blockquote', () => {
    const items = decorate('> first line\n> second line')
    expect(items.filter((i) => i.spec.class === 'cm-blockquote')).toHaveLength(2)
  })
})

describe('buildDecorations — task lists', () => {
  it('renders a checkbox per task item reflecting its checked state', () => {
    const boxes = decorate('- [x] done\n- [ ] todo')
      .map((i) => i.spec.widget)
      .filter((w): w is TaskCheckboxWidget => w instanceof TaskCheckboxWidget)
    expect(boxes.map((b) => b.checked)).toEqual([true, false])
  })

  it('hides the bullet for task items (the checkbox stands in)', () => {
    const bullets = decorate('- [ ] todo')
      .map((i) => i.spec.widget)
      .filter((w): w is BulletWidget => w instanceof BulletWidget)
    expect(bullets).toHaveLength(0)
  })
})

describe('buildDecorations — horizontal rule & links', () => {
  it('replaces a horizontal rule with an hr widget on idle lines', () => {
    const hrs = decorate('para\n\n---\n\nmore')
      .map((i) => i.spec.widget)
      .filter((w): w is HrWidget => w instanceof HrWidget)
    expect(hrs).toHaveLength(1)
  })

  it('hides the URL of an inline link but keeps the styled label', () => {
    const items = decorate('see [docs](https://x.io) now')
    const hidden = items.filter(
      (i) => i.from !== i.to && i.spec.widget === undefined && i.spec.class === undefined
    )
    expect(hidden.length).toBeGreaterThan(0)
    expect(items.some((i) => i.spec.class === 'ink-link')).toBe(true)
  })

  it('finds the URL of an inline link for ctrl/cmd-click', () => {
    expect(linkUrlAt(parsed('see [docs](https://x.io) now'), 6)).toBe('https://x.io')
  })

  it('resolves a reference link to its definition URL', () => {
    expect(linkUrlAt(parsed('use [Inkwell][repo] here\n\n[repo]: https://r.io'), 6)).toBe(
      'https://r.io'
    )
  })

  it('reads an autolink target', () => {
    expect(linkUrlAt(parsed('ping <https://a.io> ok'), 8)).toBe('https://a.io')
  })

  it('returns the #anchor target for an internal link', () => {
    expect(linkUrlAt(parsed('jump to [tasks](#tasks)'), 10)).toBe('#tasks')
  })

  it('maps an internal anchor to a heading offset', () => {
    expect(headingOffset(parsed('# Tasks\n\nbody'), 'tasks')).toBe(0)
  })
})

describe('buildDecorations — inline extras', () => {
  it('styles highlight, underline, subscript and superscript', () => {
    const classes = decorate('==hi== <u>u</u> H~2~O x^2^')
      .map((i) => i.spec.class)
      .filter(Boolean)
    expect(classes).toContain('ink-highlight')
    expect(classes).toContain('ink-u')
    expect(classes).toContain('ink-sub')
    expect(classes).toContain('ink-sup')
  })

  it('hides an HTML comment on idle lines', () => {
    const hidden = decorate('a <!-- note --> b').filter(
      (i) => i.from !== i.to && i.spec.widget === undefined && i.spec.class === undefined
    )
    expect(hidden.length).toBeGreaterThan(0)
  })

  it('renders emoji shortcodes as emoji on idle lines', () => {
    const widgets = decorate(':tada: party')
      .map((i) => i.spec.widget)
      .filter((w): w is EmojiWidget => w instanceof EmojiWidget)
    expect(widgets).toHaveLength(1)
    expect(widgets[0].char.length).toBeGreaterThan(0)
  })
})

describe('resolveImageSrc', () => {
  it('passes through remote and data URLs', () => {
    expect(resolveImageSrc('https://x.io/a.png', 'D:\\d\\f.md')).toBe('https://x.io/a.png')
    expect(resolveImageSrc('data:image/png;base64,AAAA', null)).toBe('data:image/png;base64,AAAA')
  })

  it('resolves a relative path against the Windows document folder', () => {
    expect(resolveImageSrc('img/a.png', 'D:\\docs\\f.md')).toBe('inkfile:///D:/docs/img/a.png')
  })

  it('resolves ../ segments', () => {
    expect(resolveImageSrc('../pics/a.png', 'D:\\docs\\sub\\f.md')).toBe(
      'inkfile:///D:/docs/pics/a.png'
    )
  })

  it('resolves a relative path against a POSIX document folder', () => {
    expect(resolveImageSrc('a.png', '/home/u/f.md')).toBe('inkfile:///home/u/a.png')
  })

  it('serves an explicit file: URL through the inkfile protocol', () => {
    expect(resolveImageSrc('file:///C:/x/a.png', null)).toBe('inkfile:///C:/x/a.png')
  })

  it('returns the raw src when there is no document path', () => {
    expect(resolveImageSrc('img/a.png', null)).toBe('img/a.png')
  })
})

describe('buildDecorations — images', () => {
  it('renders an image widget for ![alt](src) on idle lines', () => {
    const imgs = decorate('![cat](https://x.io/c.png)')
      .map((i) => i.spec.widget)
      .filter((w): w is ImageWidget => w instanceof ImageWidget)
    expect(imgs).toHaveLength(1)
    expect(imgs[0].alt).toBe('cat')
    expect(imgs[0].src).toBe('https://x.io/c.png')
  })

  it('centers a paragraph that is only an image', () => {
    expect(decorate('![x](https://x.io/c.png)').some((i) => i.spec.class === 'ink-img-line')).toBe(
      true
    )
  })

  it('shows raw markdown for an image on the active line', () => {
    const imgs = decorate('![cat](https://x.io/c.png)', [1])
      .map((i) => i.spec.widget)
      .filter((w): w is ImageWidget => w instanceof ImageWidget)
    expect(imgs).toHaveLength(0)
  })

  it('renders an HTML <img> tag with its width', () => {
    const imgs = decorate('<img src="https://x.io/c.png" alt="cat" width="120" />')
      .map((i) => i.spec.widget)
      .filter((w): w is ImageWidget => w instanceof ImageWidget)
    expect(imgs).toHaveLength(1)
    expect(imgs[0].width).toBe(120)
    expect(imgs[0].alt).toBe('cat')
  })
})

describe('buildDecorations — fenced code', () => {
  const fence = '```js\nconst x = 1\n```'

  it('hides the fence text and shades the code panel on an idle block', () => {
    const items = decorate(fence)
    // Panel spans `first`..`last-1` (the opening fence merges into the first
    // code line) — so for a 3-line fence that's 2 shaded line decorations.
    const shaded = items.filter((i) => String(i.spec.class ?? '').includes('ink-code-block'))
    expect(shaded).toHaveLength(2)
    // The two fence lines are hidden via plain replace decorations.
    const hides = items.filter((i) => !i.spec.class && !i.spec.widget)
    expect(hides.length).toBeGreaterThanOrEqual(2)
  })

  it('shows every line raw when the caret is inside the block', () => {
    const shaded = decorate(fence, [2]).filter((i) =>
      String(i.spec.class ?? '').includes('ink-code-block')
    )
    expect(shaded).toHaveLength(3) // all three lines, fences revealed
  })

  it('rounds the first and last lines of the panel', () => {
    const items = decorate(fence)
    expect(items.some((i) => String(i.spec.class ?? '').includes('ink-code-first'))).toBe(true)
    expect(items.some((i) => String(i.spec.class ?? '').includes('ink-code-last'))).toBe(true)
  })

  it('adds a language badge carrying the lang and code text', () => {
    const badges = decorate(fence)
      .map((i) => i.spec.widget)
      .filter((w): w is CodeBadgeWidget => w instanceof CodeBadgeWidget)
    expect(badges).toHaveLength(1)
    expect(badges[0].lang).toBe('js')
    expect(badges[0].code).toBe('const x = 1')
  })

  it('anchors the badge outside the hidden fence ranges (so it stays visible)', () => {
    const items = decorate(fence)
    const badge = items.find((i) => i.spec.widget instanceof CodeBadgeWidget)!
    const hides = items.filter((i) => !i.spec.class && !i.spec.widget)
    const swallowed = hides.some((h) => badge.from >= h.from && badge.from < h.to)
    expect(swallowed).toBe(false)
  })
})

describe('buildDecorations — tables', () => {
  const tbl = '| A | B |\n| - | - |\n| 1 | 2 |'

  it('renders a table widget on idle lines', () => {
    const w = decorate(tbl)
      .map((i) => i.spec.widget)
      .filter((x): x is TableWidget => x instanceof TableWidget)
    expect(w).toHaveLength(1)
    expect(w[0].md).toContain('| A | B |')
  })

  it('keeps the table raw when the caret is inside it', () => {
    const w = decorate(tbl, [2])
      .map((i) => i.spec.widget)
      .filter((x): x is TableWidget => x instanceof TableWidget)
    expect(w).toHaveLength(0)
  })
})

describe('buildDecorations — HTML blocks', () => {
  it('renders an HTML block as a sanitized widget on idle lines', () => {
    const w = decorate('<div class="box">hi</div>')
      .map((i) => i.spec.widget)
      .filter((x): x is HtmlBlockWidget => x instanceof HtmlBlockWidget)
    expect(w).toHaveLength(1)
    expect(w[0].html).toContain('<div')
  })

  it('keeps an HTML block raw on the active line', () => {
    const w = decorate('<div class="box">hi</div>', [1])
      .map((i) => i.spec.widget)
      .filter((x): x is HtmlBlockWidget => x instanceof HtmlBlockWidget)
    expect(w).toHaveLength(0)
  })
})

describe('buildDecorations — table of contents', () => {
  const doc = '[toc]\n\n# Alpha\n\n## Beta'

  it('replaces [toc] with a TOC widget listing the headings', () => {
    const tocs = decorate(doc)
      .map((i) => i.spec.widget)
      .filter((w): w is TocWidget => w instanceof TocWidget)
    expect(tocs).toHaveLength(1)
    expect(tocs[0].headings.map((h) => h.text)).toEqual(['Alpha', 'Beta'])
  })

  it('keeps [toc] raw on the active line', () => {
    const tocs = decorate(doc, [1])
      .map((i) => i.spec.widget)
      .filter((w): w is TocWidget => w instanceof TocWidget)
    expect(tocs).toHaveLength(0)
  })
})

describe('buildDecorations — YAML front matter', () => {
  it('styles the front-matter block at the top of the document', () => {
    const fm = decorate('---\ntitle: Hi\ndate: 2026\n---\n\n# Body').filter((i) =>
      String(i.spec.class ?? '').includes('ink-frontmatter')
    )
    expect(fm).toHaveLength(4) // ---, title, date, ---
  })

  it('marks first and last fence lines of the front matter', () => {
    const items = decorate('---\na: 1\n---')
    expect(items.some((i) => String(i.spec.class ?? '').includes('ink-frontmatter-first'))).toBe(
      true
    )
    expect(items.some((i) => String(i.spec.class ?? '').includes('ink-frontmatter-last'))).toBe(true)
  })

  it('ignores a --- that is not on the first line', () => {
    const fm = decorate('# Title\n\n---\nnot: frontmatter\n---').filter((i) =>
      String(i.spec.class ?? '').includes('ink-frontmatter')
    )
    expect(fm).toHaveLength(0)
  })
})

describe('buildDecorations — footnotes', () => {
  const doc = 'See note[^1] here.\n\n[^1]: The footnote text.'

  it('renders a footnote reference with the definition as tooltip text', () => {
    const refs = decorate(doc)
      .map((i) => i.spec.widget)
      .filter((w): w is FootnoteRefWidget => w instanceof FootnoteRefWidget)
    expect(refs).toHaveLength(1)
    expect(refs[0].id).toBe('1')
    expect(refs[0].text).toBe('The footnote text.')
  })

  it('does not render a reference inside the definition line itself', () => {
    // Only the in-text [^1] becomes a widget, not the [^1]: definition.
    const refs = decorate(doc)
      .map((i) => i.spec.widget)
      .filter((w): w is FootnoteRefWidget => w instanceof FootnoteRefWidget)
    expect(refs).toHaveLength(1)
  })

  it('keeps the reference raw on the active line', () => {
    const refs = decorate(doc, [1])
      .map((i) => i.spec.widget)
      .filter((w): w is FootnoteRefWidget => w instanceof FootnoteRefWidget)
    expect(refs).toHaveLength(0)
  })
})

describe('buildDecorations — GitHub alerts', () => {
  const note = '> [!NOTE]\n> Useful info here'

  it('tags alert lines with the typed alert class', () => {
    const lines = decorate(note).filter((i) => String(i.spec.class ?? '').includes('ink-alert-note'))
    expect(lines.length).toBe(2)
  })

  it('replaces the [!NOTE] marker with a label widget on idle lines', () => {
    const labels = decorate(note)
      .map((i) => i.spec.widget)
      .filter((w): w is AlertLabelWidget => w instanceof AlertLabelWidget)
    expect(labels).toHaveLength(1)
    expect(labels[0].type).toBe('note')
  })

  it('keeps the [!WARNING] marker raw on the active line', () => {
    const labels = decorate('> [!WARNING]\n> careful', [1])
      .map((i) => i.spec.widget)
      .filter((w): w is AlertLabelWidget => w instanceof AlertLabelWidget)
    expect(labels).toHaveLength(0)
  })

  it('leaves a plain blockquote unstyled as an alert', () => {
    const lines = decorate('> just a quote').filter((i) =>
      String(i.spec.class ?? '').includes('ink-alert')
    )
    expect(lines).toHaveLength(0)
  })
})

describe('buildDecorations — mermaid', () => {
  const diagram = '```mermaid\ngraph LR\nA-->B\n```'

  it('renders a mermaid widget on idle lines (no code badge)', () => {
    const items = decorate(diagram)
    const merm = items.map((i) => i.spec.widget).filter((w) => w instanceof MermaidWidget)
    const badges = items.map((i) => i.spec.widget).filter((w) => w instanceof CodeBadgeWidget)
    expect(merm).toHaveLength(1)
    expect(badges).toHaveLength(0)
  })

  it('shows raw source (code badge, no diagram) when the block is active', () => {
    const items = decorate(diagram, [1])
    expect(items.map((i) => i.spec.widget).filter((w) => w instanceof MermaidWidget)).toHaveLength(0)
  })

  it('still renders a normal code block as a badge, not a diagram', () => {
    const items = decorate('```js\nconst x=1\n```')
    expect(items.map((i) => i.spec.widget).filter((w) => w instanceof MermaidWidget)).toHaveLength(0)
    expect(
      items.map((i) => i.spec.widget).filter((w) => w instanceof CodeBadgeWidget)
    ).toHaveLength(1)
  })
})

describe('buildDecorations — math', () => {
  function mathWidgets(doc: string, active: number[] = []): MathWidget[] {
    return decorate(doc, active)
      .map((i) => i.spec.widget)
      .filter((w): w is MathWidget => w instanceof MathWidget)
  }

  it('renders inline math $…$', () => {
    const w = mathWidgets('see $x^2$ here')
    expect(w).toHaveLength(1)
    expect(w[0].block).toBe(false)
    expect(w[0].tex).toBe('x^2')
  })

  it('renders block math $$…$$', () => {
    const w = mathWidgets('$$a+b$$')
    expect(w).toHaveLength(1)
    expect(w[0].block).toBe(true)
    expect(w[0].tex).toBe('a+b')
  })

  it('does not treat $$ block as two inline maths', () => {
    expect(mathWidgets('$$x$$').filter((m) => !m.block)).toHaveLength(0)
  })

  it('shows raw source for math on the active line', () => {
    expect(mathWidgets('see $x^2$ here', [1])).toHaveLength(0)
  })

  it('ignores a lone dollar sign', () => {
    expect(mathWidgets('costs $5 today')).toHaveLength(0)
  })

  it('keeps a real multi-line $$ block (no blank line inside)', () => {
    const w = mathWidgets('$$\n\\int_0^1 x\\,dx\n$$')
    expect(w).toHaveLength(1)
    expect(w[0].block).toBe(true)
  })

  it('does NOT join two stray $$ across a blank line (would hide paragraphs)', () => {
    // Two unrelated `$$` (e.g. prices) separated by a blank line must not be
    // treated as one block that swallows everything between them.
    const doc = 'price is $$ here\n\nlots of text\n\nand $$ there'
    expect(mathWidgets(doc)).toHaveLength(0)
  })
})

describe('buildDecorations — headings & inline', () => {
  it('tags heading lines with size classes', () => {
    expect(decorate('# Title').some((i) => i.spec.class === 'ink-h1')).toBe(true)
  })

  it('styles bold and hides its emphasis markers on inactive lines', () => {
    const items = decorate('a **bold** b')
    expect(items.some((i) => i.spec.class === 'ink-strong')).toBe(true)
    // The ** markers become empty replace decorations (no widget, no class).
    const hiddenMarks = items.filter(
      (i) => i.from !== i.to && i.spec.widget === undefined && i.spec.class === undefined
    )
    expect(hiddenMarks.length).toBeGreaterThan(0)
  })
})
