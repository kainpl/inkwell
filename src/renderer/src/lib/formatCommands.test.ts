import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  wrapSelection,
  setHeading,
  insertLink,
  applyFormat,
  toggleImageSyntax,
  setImageWidth,
  setImageSrc,
  imageSrcOnLine,
  stripInlineMarkdown,
  prettifyMarkdown,
  nextFootnoteId
} from './formatCommands'

function mkView(doc: string, from: number, to = from): EditorView {
  const state = EditorState.create({
    doc,
    selection: { anchor: from, head: to },
    extensions: [markdown({ base: markdownLanguage })]
  })
  const parent = document.body.appendChild(document.createElement('div'))
  return new EditorView({ state, parent })
}

describe('formatCommands', () => {
  it('wraps a selection in bold marks', () => {
    const view = mkView('hello world', 0, 5)
    wrapSelection(view, '**')
    expect(view.state.doc.toString()).toBe('**hello** world')
    view.destroy()
  })

  it('unwraps when the selection is already bold', () => {
    const view = mkView('**hello** world', 2, 7) // selection over "hello"
    wrapSelection(view, '**')
    expect(view.state.doc.toString()).toBe('hello world')
    view.destroy()
  })

  it('sets and toggles a heading on the current line', () => {
    const view = mkView('title', 0)
    setHeading(view, 2)
    expect(view.state.doc.toString()).toBe('## title')
    setHeading(view, 2) // same level again -> clear
    expect(view.state.doc.toString()).toBe('title')
    view.destroy()
  })

  it('inserts a link using the selection as label', () => {
    const view = mkView('click here', 0, 10)
    insertLink(view)
    expect(view.state.doc.toString()).toBe('[click here](https://)')
    view.destroy()
  })

  it('toggles a bullet list across selected lines', () => {
    const view = mkView('a\nb', 0, 3)
    applyFormat(view, 'ul')
    expect(view.state.doc.toString()).toBe('- a\n- b')
    applyFormat(view, 'ul')
    expect(view.state.doc.toString()).toBe('a\nb')
    view.destroy()
  })

  it('numbers an ordered list sequentially', () => {
    const view = mkView('a\nb', 0, 3)
    applyFormat(view, 'ol')
    expect(view.state.doc.toString()).toBe('1. a\n2. b')
    view.destroy()
  })

  it('toggles a quote on the current line', () => {
    const view = mkView('note', 0)
    applyFormat(view, 'quote')
    expect(view.state.doc.toString()).toBe('> note')
    view.destroy()
  })

  it('toggles an image between markdown and HTML syntax', () => {
    const view = mkView('![cat](a.png)', 2)
    toggleImageSyntax(view)
    expect(view.state.doc.toString()).toBe('<img src="a.png" alt="cat" />')
    toggleImageSyntax(view)
    expect(view.state.doc.toString()).toBe('![cat](a.png)')
    view.destroy()
  })

  it('sets an image width (switching to HTML syntax)', () => {
    const view = mkView('![cat](a.png)', 2)
    setImageWidth(view, 200)
    expect(view.state.doc.toString()).toBe('<img src="a.png" alt="cat" width="200" />')
    view.destroy()
  })

  it('does nothing when the line is not an image', () => {
    const view = mkView('plain text', 2)
    expect(toggleImageSyntax(view)).toBe(false)
    view.destroy()
  })

  it('reads and rewrites the image src on the current line', () => {
    const view = mkView('![cat](local.png)', 2)
    expect(imageSrcOnLine(view)).toBe('local.png')
    setImageSrc(view, 'https://cdn.io/cat.png')
    expect(view.state.doc.toString()).toBe('![cat](https://cdn.io/cat.png)')
    view.destroy()
  })

  it('clears inline formatting from the selection', () => {
    const view = mkView('a **bold** _it_ ~~no~~ `c` ==hi== [t](u) z', 0, 41)
    applyFormat(view, 'clearFormat')
    expect(view.state.doc.toString()).toBe('a bold it no c hi t z')
    view.destroy()
  })

  it('wraps sub/sup/inline-math around the selection', () => {
    const sub = mkView('H2O', 1, 2)
    applyFormat(sub, 'sub')
    expect(sub.state.doc.toString()).toBe('H~2~O')
    sub.destroy()
    const sup = mkView('x2', 1, 2)
    applyFormat(sup, 'sup')
    expect(sup.state.doc.toString()).toBe('x^2^')
    sup.destroy()
    const math = mkView('E=mc2', 0, 5)
    applyFormat(math, 'mathInline')
    expect(math.state.doc.toString()).toBe('$E=mc2$')
    math.destroy()
  })

  it('sets headings 4–6', () => {
    const view = mkView('title', 0)
    applyFormat(view, 'h4')
    expect(view.state.doc.toString()).toBe('#### title')
    applyFormat(view, 'h6')
    expect(view.state.doc.toString()).toBe('###### title')
    view.destroy()
  })

  it('inserts a math block, mermaid block and toc', () => {
    const math = mkView('', 0)
    applyFormat(math, 'mathBlock')
    expect(math.state.doc.toString()).toBe('$$\n\n$$\n')
    math.destroy()
    const mer = mkView('', 0)
    applyFormat(mer, 'mermaid')
    expect(mer.state.doc.toString()).toBe('```mermaid\n\n```\n')
    mer.destroy()
    const toc = mkView('', 0)
    applyFormat(toc, 'toc')
    expect(toc.state.doc.toString()).toBe('[toc]\n')
    toc.destroy()
  })

  it('inserts an alert block', () => {
    const view = mkView('', 0)
    applyFormat(view, 'alert:warning')
    expect(view.state.doc.toString()).toBe('> [!WARNING]\n> \n')
    view.destroy()
  })

  it('inserts a footnote reference + definition with the next free id', () => {
    const view = mkView('see here', 8)
    applyFormat(view, 'footnote')
    expect(view.state.doc.toString()).toBe('see here[^1]\n[^1]: \n')
    view.destroy()
  })
})

describe('nextFootnoteId', () => {
  it('returns the first free footnote number', () => {
    expect(nextFootnoteId('no notes')).toBe(1)
    expect(nextFootnoteId('a[^1] b[^2]')).toBe(3)
    expect(nextFootnoteId('a[^1] b[^3]')).toBe(2) // fills the gap
  })
})

describe('stripInlineMarkdown', () => {
  it('removes bold, italic, strike, code, highlight and link markers', () => {
    expect(stripInlineMarkdown('**b** *i* ~~s~~ `c` ==h==')).toBe('b i s c h')
    expect(stripInlineMarkdown('see [docs](http://x)')).toBe('see docs')
  })

  it('leaves snake_case identifiers alone', () => {
    expect(stripInlineMarkdown('a my_var_name b')).toBe('a my_var_name b')
  })
})

describe('prettifyMarkdown', () => {
  it('strips trailing whitespace and fixes heading spacing', () => {
    expect(prettifyMarkdown('#Title  \ntext   \n')).toBe('# Title\ntext\n')
  })

  it('collapses runs of blank lines and ensures one trailing newline', () => {
    expect(prettifyMarkdown('a\n\n\n\nb')).toBe('a\n\nb\n')
  })

  it('strips trailing whitespace from prose lines', () => {
    expect(prettifyMarkdown('line  \nnext')).toBe('line\nnext\n')
  })

  it('never touches content inside fenced code', () => {
    const code = '```\n#notaheading\n\n\n  spaced  \n```\n'
    expect(prettifyMarkdown(code)).toBe('```\n#notaheading\n\n\n  spaced  \n```\n')
  })
})
