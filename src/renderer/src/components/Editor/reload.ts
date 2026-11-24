import { Annotation, EditorSelection, MapMode, Transaction } from '@codemirror/state'
import { diff } from '@codemirror/merge'
import { EditorView } from '@codemirror/view'

export const diskReload = Annotation.define<boolean>()

export function refreshEditor(
  view: EditorView,
  content: string,
  snapshot = view.scrollSnapshot()
): void {
  const before = view.state.doc.toString()
  const after = content.replace(/\r\n?/g, '\n')
  if (before === after) return
  const changes = view.state.changes(
    diff(before, after, { scanLimit: 500, timeout: 50 }).map(({ fromA, toA, fromB, toB }) => ({
      from: fromA,
      to: toA,
      insert: after.slice(fromB, toB)
    }))
  )
  const oldDoc = view.state.doc
  const newDoc = changes.apply(oldDoc)
  const map = (position: number, assoc: number) => {
    const mapped = changes.mapPos(position, assoc, MapMode.TrackDel)
    if (mapped !== null) return mapped
    // If the original text was rewritten, keep the line and column within its replacement.
    let fallback = changes.mapPos(position, assoc)
    changes.iterChangedRanges((fromA, toA, fromB, toB) => {
      if (position <= fromA || position >= toA || fromB === toB) return
      const oldLine = oldDoc.lineAt(position)
      const lineOffset = oldLine.number - oldDoc.lineAt(fromA).number
      const newLine = newDoc.line(
        Math.min(newDoc.lineAt(fromB).number + lineOffset, newDoc.lineAt(toB).number)
      )
      fallback = Math.max(fromB, Math.min(toB, newLine.to, newLine.from + position - oldLine.from))
    })
    return fallback
  }
  const { ranges, mainIndex } = view.state.selection
  const top = snapshot.value.range.head
  const scroll =
    changes.mapPos(top, -1, MapMode.TrackDel) === null
      ? EditorView.scrollIntoView(map(top, -1), { y: 'start', yMargin: snapshot.value.yMargin })
      : snapshot.map(changes)
  view.dispatch({
    changes,
    selection: EditorSelection.create(
      ranges.map((range) => {
        if (range.empty) return EditorSelection.cursor(map(range.head, 1), range.assoc)
        const from = map(range.from, 1)
        const to = Math.max(from, map(range.to, -1))
        return range.anchor <= range.head
          ? EditorSelection.range(from, to)
          : EditorSelection.range(to, from)
      }),
      mainIndex
    ),
    effects: scroll,
    annotations: [diskReload.of(true), Transaction.addToHistory.of(false)],
    filter: false
  })
}
