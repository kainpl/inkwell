import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  wrapSelection,
  setHeading,
  insertLink,
  applyFormat
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
})
