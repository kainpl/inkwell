import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { applyTable, applyTableAt, tableAt, inTable } from './tableCommands'

const TBL = '| A | B |\n| - | - |\n| 1 | 2 |'

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

describe('tableCommands', () => {
  it('detects the table and caret cell position', () => {
    const view = mkView(TBL, TBL.indexOf('1')) // first body cell
    const ctx = tableAt(view)!
    expect(ctx.row).toBe(0)
    expect(ctx.col).toBe(0)
    expect(inTable(view)).toBe(true)
    view.destroy()
  })

  it('returns null when the caret is not in a table', () => {
    const view = mkView('just text', 2)
    expect(tableAt(view)).toBeNull()
    view.destroy()
  })

  it('adds a row below the caret row', () => {
    const view = mkView(TBL, TBL.indexOf('1'))
    applyTable(view, 'rowBelow')
    expect(view.state.doc.toString()).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n|  |  |')
    view.destroy()
  })

  it('deletes the caret row', () => {
    const view = mkView(TBL, TBL.indexOf('1'))
    applyTable(view, 'deleteRow')
    expect(view.state.doc.toString()).toBe('| A | B |\n| --- | --- |')
    view.destroy()
  })

  it('adds a column after the caret column', () => {
    const view = mkView(TBL, TBL.indexOf('A'))
    applyTable(view, 'colAfter')
    expect(view.state.doc.toString().split('\n')[0]).toBe('| A |  | B |')
    view.destroy()
  })

  it('sets the caret column alignment', () => {
    const view = mkView(TBL, TBL.indexOf('A'))
    applyTable(view, 'alignCenter')
    expect(view.state.doc.toString().split('\n')[1]).toBe('| :-: | --- |')
    view.destroy()
  })

  it('applyTableAt edits the table even when the caret is outside it', () => {
    const doc = 'hi\n\n' + TBL
    const view = mkView(doc, 1) // caret in "hi", not the table
    expect(inTable(view)).toBe(false)
    expect(applyTable(view, 'deleteRow')).toBe(false) // caret-based can't locate it
    const ok = applyTableAt(view, doc.indexOf('A'), 0, 0, 'deleteRow')
    expect(ok).toBe(true)
    expect(view.state.doc.toString()).toBe('hi\n\n| A | B |\n| --- | --- |')
    view.destroy()
  })
})
