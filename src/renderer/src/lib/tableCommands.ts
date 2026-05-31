import type { EditorView } from '@codemirror/view'
import type { Text } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import {
  parseTable,
  serializeTable,
  addRow,
  deleteRow,
  addColumn,
  deleteColumn,
  setColumnAlign,
  type Align,
  type TableModel
} from './tableModel'

export type TableAction =
  | 'rowAbove'
  | 'rowBelow'
  | 'deleteRow'
  | 'colBefore'
  | 'colAfter'
  | 'deleteCol'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'

interface TableContext {
  from: number
  to: number
  model: TableModel
  /** Caret's body-row index (-1 = header/delimiter), and column index. */
  row: number
  col: number
}

/** A line is part of a table if it is non-blank and contains a pipe. */
function isTableLine(text: string): boolean {
  return text.trim() !== '' && text.includes('|')
}

/**
 * Full [from,to] of the contiguous table block containing line `lineNo`.
 * Used instead of the Lezer node bounds, which can be partial in a live view.
 */
export function expandTableRange(doc: Text, lineNo: number): { from: number; to: number } {
  let first = lineNo
  let last = lineNo
  while (first > 1 && isTableLine(doc.line(first - 1).text)) first--
  while (last < doc.lines && isTableLine(doc.line(last + 1).text)) last++
  return { from: doc.line(first).from, to: doc.line(last).to }
}

/** Locate the GFM table containing the caret, with the caret's cell position. */
export function tableAt(view: EditorView): TableContext | null {
  const pos = view.state.selection.main.head
  let node = syntaxTree(view.state).resolveInner(pos, 0)
  while (node && node.name !== 'Table') node = node.parent as typeof node
  if (!node) return null

  // Expand to the full contiguous table block (Lezer bounds may be partial).
  const { from, to } = expandTableRange(view.state.doc, view.state.doc.lineAt(node.from).number)
  const md = view.state.doc.sliceString(from, to)
  const model = parseTable(md)
  if (!model) return null

  // Determine caret's row/column from line offset within the table.
  const startLine = view.state.doc.lineAt(from).number
  const caretLine = view.state.doc.lineAt(pos).number
  const lineOffset = caretLine - startLine // 0 header, 1 delimiter, 2+ body
  const row = lineOffset >= 2 ? lineOffset - 2 : -1

  const lineText = view.state.doc.lineAt(pos).text
  const colChar = pos - view.state.doc.lineAt(pos).from
  const col = Math.max(0, lineText.slice(0, colChar).split('|').length - 2)

  return { from: node.from, to: node.to, model, row, col }
}

/** True when the caret is currently inside a table. */
export function inTable(view: EditorView): boolean {
  return tableAt(view) !== null
}

function replace(view: EditorView, ctx: TableContext, model: TableModel): boolean {
  const md = serializeTable(model)
  view.dispatch({ changes: { from: ctx.from, to: ctx.to, insert: md } })
  view.focus()
  return true
}

/** Apply a structural table edit relative to the caret position. */
export function applyTable(view: EditorView, action: TableAction): boolean {
  const ctx = tableAt(view)
  if (!ctx) return false
  const { model, row, col } = ctx
  const align = (a: Align): boolean => replace(view, ctx, setColumnAlign(model, col, a))
  switch (action) {
    case 'rowAbove':
      return replace(view, ctx, addRow(model, row < 0 ? 0 : row))
    case 'rowBelow':
      return replace(view, ctx, addRow(model, row < 0 ? 0 : row + 1))
    case 'deleteRow':
      return row < 0 ? false : replace(view, ctx, deleteRow(model, row))
    case 'colBefore':
      return replace(view, ctx, addColumn(model, col))
    case 'colAfter':
      return replace(view, ctx, addColumn(model, col + 1))
    case 'deleteCol':
      return replace(view, ctx, deleteColumn(model, col))
    case 'alignLeft':
      return align('left')
    case 'alignCenter':
      return align('center')
    case 'alignRight':
      return align('right')
    default:
      return false
  }
}
