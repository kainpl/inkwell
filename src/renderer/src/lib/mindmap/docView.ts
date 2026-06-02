import { EditorView } from '@codemirror/view'

/** The doc pane's live CodeMirror view (one project tab is active at a time). */
let current: EditorView | null = null
export const setDocView = (v: EditorView | null): void => {
  current = v
}
export const getDocView = (): EditorView | null => current

let counter = 0
const shortId = (): string => `a${(counter++).toString(36)}${Date.now().toString(36).slice(-3)}`

/**
 * Insert an explicit anchor at the caret: `{#id}` appended to a heading line,
 * else a trailing `^id` block id. The doc's update listener buffers the edit.
 */
export function insertAnchorAtCaret(): string | null {
  const view = current
  if (!view) return null
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const isHeading = /^#{1,6}\s/.test(line.text)
  const id = shortId()
  const insert = isHeading ? ` {#${id}}` : ` ^${id}`
  view.dispatch({ changes: { from: line.to, insert } })
  view.focus()
  return id
}
