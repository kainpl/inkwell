import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage, insertNewlineContinueMarkup } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { selectWord, selectSentence, blockInputRules } from './markdownExtensions'

/**
 * Behavioural tests for the editing "magic" (commands that run against a live
 * EditorView), since these features produce no static markdown sample.
 * Auto-pairing is NOT covered here: it hooks the DOM beforeinput handler, which
 * jsdom does not fire — confirm it manually in `npm run dev`.
 */
function mkView(doc: string, cursor: number): EditorView {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage })]
  })
  ensureSyntaxTree(state, state.doc.length, 5000)
  const parent = document.body.appendChild(document.createElement('div'))
  return new EditorView({ state, parent })
}

function sel(view: EditorView): string {
  const r = view.state.selection.main
  return view.state.sliceDoc(r.from, r.to)
}

describe('editing — auto-continue lists', () => {
  it('continues a bullet list when Enter is pressed at end of item', () => {
    const view = mkView('- milk', 6)
    insertNewlineContinueMarkup(view)
    expect(view.state.doc.toString()).toBe('- milk\n- ')
    view.destroy()
  })

  it('continues an ordered list with the next number', () => {
    const view = mkView('1. one', 6)
    insertNewlineContinueMarkup(view)
    expect(view.state.doc.toString()).toBe('1. one\n2. ')
    view.destroy()
  })
})

describe('editing — block input rules (Enter)', () => {
  it('scaffolds a GFM table from a header row', () => {
    const view = mkView('| Name | Age |', 14)
    expect(blockInputRules(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('| Name | Age |\n| --- | --- |\n|   |   |')
    view.destroy()
  })

  it('scaffolds a fenced code block from ```lang', () => {
    const view = mkView('```js', 5)
    expect(blockInputRules(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('```js\n\n```')
    view.destroy()
  })

  it('scaffolds a math block from $$', () => {
    const view = mkView('$$', 2)
    expect(blockInputRules(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('$$\n\n$$')
    view.destroy()
  })

  it('does not fire mid-line or on a normal paragraph', () => {
    const view = mkView('just text', 4)
    expect(blockInputRules(view)).toBe(false)
    view.destroy()
  })

  it('does not re-fire when a table separator already follows', () => {
    const view = mkView('| a | b |\n| --- | --- |', 9)
    expect(blockInputRules(view)).toBe(false)
    view.destroy()
  })
})

describe('editing — smart selection', () => {
  it('selectWord selects the word under the cursor', () => {
    const view = mkView('hello world', 2)
    selectWord(view)
    expect(sel(view)).toBe('hello')
    view.destroy()
  })

  it('selectSentence selects the sentence around the cursor', () => {
    const view = mkView('First sentence. Second one.', 3)
    selectSentence(view)
    expect(sel(view)).toBe('First sentence.')
    view.destroy()
  })

  it('selectSentence picks the second sentence when cursor is in it', () => {
    const view = mkView('First sentence. Second one.', 20)
    selectSentence(view)
    expect(sel(view)).toBe('Second one.')
    view.destroy()
  })
})
