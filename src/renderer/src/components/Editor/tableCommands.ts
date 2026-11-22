import type { EditorView } from '@codemirror/view'
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

/** Locate the GFM table containing the caret, with the caret's cell position. */
export function tableAt(view: EditorView): TableContext | null {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  let node = syntaxTree(view.state).resolveInner(pos, pos === line.to ? -1 : 1)
  while (node.parent && node.name !== 'Table') node = node.parent
  if (node.name !== 'Table') return null

  const { from, to } = node
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
  const col = Math.max(0, (lineText.slice(0, colChar).match(/(?<!\\)\|/g)?.length ?? 0) - Number(lineText.trimStart().startsWith('|')))

  return { from: node.from, to: node.to, model, row, col }
}

function replace(view: EditorView, ctx: TableContext, model: TableModel): boolean {
  const md = serializeTable(model)
  view.dispatch({ changes: { from: ctx.from, to: ctx.to, insert: md } })
  view.focus()
  return true
}

/** Core switch: apply `action` to a resolved table context at (row, col). */
function applyToContext(view: EditorView, ctx: TableContext, action: TableAction): boolean {
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

/** Apply a structural table edit relative to the caret position. */
export function applyTable(view: EditorView, action: TableAction): boolean {
  const ctx = tableAt(view)
  return ctx ? applyToContext(view, ctx, action) : false
}

/**
 * Apply a table edit at an explicit document position with an explicit target
 * (row, col). Used by the rendered-table inline toolbar, where the caret is
 * NOT inside the table, so the caret-based `applyTable` can't locate it.
 */
export function applyTableAt(
  view: EditorView,
  pos: number,
  row: number,
  col: number,
  action: TableAction
): boolean {
  let node = syntaxTree(view.state).resolveInner(pos, 1)
  while (node.parent && node.name !== 'Table') node = node.parent
  if (node.name !== 'Table') return false
  const { from, to } = node
  const model = parseTable(view.state.doc.sliceString(from, to))
  if (!model) return false
  return applyToContext(view, { from, to, model, row, col }, action)
}
