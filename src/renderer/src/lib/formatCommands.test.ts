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
  imageSrcOnLine
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
})
