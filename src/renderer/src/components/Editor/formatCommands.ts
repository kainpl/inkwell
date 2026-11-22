import { translate } from '@renderer/lib/i18n'
import type { EditorView } from '@codemirror/view'

export type FormatAction = 'bold' | 'italic' | 'strike' | 'code' | 'link'

/** Wrap (or unwrap, if already wrapped) the selection with inline marks. */
export function wrapSelection(view: EditorView, mark: string, end: string = mark): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const before = state.sliceDoc(Math.max(0, from - mark.length), from)
  const after = state.sliceDoc(to, Math.min(state.doc.length, to + end.length))

  if (before === mark && after === end) {
    view.dispatch({
      changes: [
        { from: from - mark.length, to: from, insert: '' },
        { from: to, to: to + end.length, insert: '' },
      ],
      selection: { anchor: from - mark.length, head: to - mark.length },
    })
  } else {
    view.dispatch({
      changes: [
        { from, insert: mark },
        { from: to, insert: end },
      ],
      selection: { anchor: from + mark.length, head: to + mark.length },
    })
  }
  view.focus()
  return true
}

export function insertLink(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const label = state.sliceDoc(from, to) || translate('text')
  const url = 'https://'
  const md = `[${label}](${url})`
  view.dispatch({
    changes: { from, to, insert: md },
    selection: { anchor: from + label.length + 3, head: from + label.length + 3 + url.length },
  })
  view.focus()
  return true
}

export function applyFormat(view: EditorView, action: FormatAction): boolean {
  if (action === 'link') return insertLink(view)
  const marks = { bold: '**', italic: '*', strike: '~~', code: '`' }
  return wrapSelection(view, marks[action])
}
