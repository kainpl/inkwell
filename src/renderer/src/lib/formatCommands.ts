import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { parseImage, parseMarkdownImage, toHtmlImage, toMarkdownImage } from './imageInput'

/**
 * Formatting commands shared by the toolbars and the native Format menu. Each
 * operates on a live EditorView and keeps focus in the editor, so a markdown
 * novice can format text by clicking instead of typing syntax.
 */

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'highlight'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'ul'
  | 'ol'
  | 'task'
  | 'link'
  | 'image'
  | 'table'
  | 'codeblock'
  | 'hr'
  | 'toggleImageSyntax'

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
        { from: to, to: to + end.length, insert: '' }
      ],
      selection: { anchor: from - mark.length, head: to - mark.length }
    })
  } else {
    view.dispatch({
      changes: [
        { from, insert: mark },
        { from: to, insert: end }
      ],
      selection: { anchor: from + mark.length, head: to + mark.length }
    })
  }
  view.focus()
  return true
}

/** Set the heading level of the current line; clicking the active level clears it. */
export function setHeading(view: EditorView, level: number): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const m = /^(#{1,6})\s+/.exec(line.text)
  const body = line.text.slice(m ? m[0].length : 0)
  const insert = m && m[1].length === level ? body : '#'.repeat(level) + ' ' + body
  view.dispatch({ changes: { from: line.from, to: line.to, insert } })
  view.focus()
  return true
}

/** Toggle a per-line prefix (quote / lists) across the selected lines. */
function toggleLines(
  view: EditorView,
  strip: RegExp,
  prefix: (index: number) => string
): boolean {
  const { state } = view
  const range = state.selection.main
  const first = state.doc.lineAt(range.from).number
  const last = state.doc.lineAt(range.to).number

  let allHave = true
  for (let n = first; n <= last; n++) {
    if (!strip.test(state.doc.line(n).text)) {
      allHave = false
      break
    }
  }

  const changes = []
  let idx = 0
  for (let n = first; n <= last; n++) {
    const line = state.doc.line(n)
    if (allHave) {
      const m = strip.exec(line.text)
      if (m) changes.push({ from: line.from, to: line.from + m[0].length, insert: '' })
    } else {
      changes.push({ from: line.from, insert: prefix(idx) })
    }
    idx++
  }
  view.dispatch({ changes })
  view.focus()
  return true
}

/** Insert a block at the cursor, ensuring it sits on its own line(s). */
function insertBlock(view: EditorView, text: string, caretOffset: number): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const atLineStart = state.selection.main.head === line.from
  const prefix = line.text.length === 0 || atLineStart ? '' : '\n'
  const pos = state.selection.main.head
  view.dispatch({
    changes: { from: pos, insert: prefix + text },
    selection: { anchor: pos + prefix.length + caretOffset }
  })
  view.focus()
  return true
}

export function insertLink(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const label = state.sliceDoc(from, to) || 'text'
  const url = 'https://'
  const md = `[${label}](${url})`
  view.dispatch({
    changes: { from, to, insert: md },
    // Select the URL placeholder so the user can type over it.
    selection: { anchor: from + label.length + 3, head: from + label.length + 3 + url.length }
  })
  view.focus()
  return true
}

export function insertImage(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  const alt = state.sliceDoc(from, to) || 'alt'
  const md = `![${alt}](https://)`
  view.dispatch({
    changes: { from, to, insert: md },
    selection: { anchor: from + alt.length + 4, head: from + md.length - 1 }
  })
  view.focus()
  return true
}

/** Find a standalone image (md or HTML) on the current line: its range + parse. */
function imageOnLine(
  view: EditorView
): { from: number; to: number; text: string } | null {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const text = line.text.trim()
  if (!parseImage(text)) return null
  // Range of the trimmed image within the line.
  const lead = line.text.length - line.text.trimStart().length
  return { from: line.from + lead, to: line.from + lead + text.length, text }
}

/** Toggle the image on the current line between markdown and HTML syntax. */
export function toggleImageSyntax(view: EditorView): boolean {
  const found = imageOnLine(view)
  if (!found) return false
  const img = parseImage(found.text)
  if (!img) return false
  // Markdown has no width; switch to HTML to keep a size, else flip both ways.
  const next = parseMarkdownImage(found.text) ? toHtmlImage(img) : toMarkdownImage(img)
  view.dispatch({ changes: { from: found.from, to: found.to, insert: next } })
  view.focus()
  return true
}

/** Set (or clear, when width<=0) the pixel width of the image on the current line. */
export function setImageWidth(view: EditorView, width: number): boolean {
  const found = imageOnLine(view)
  if (!found) return false
  const img = parseImage(found.text)
  if (!img) return false
  const next = toHtmlImage({ ...img, width: width > 0 ? Math.round(width) : undefined })
  view.dispatch({ changes: { from: found.from, to: found.to, insert: next } })
  view.focus()
  return true
}

/** Rewrite the `src` of the image on the current line (e.g. after upload). */
export function setImageSrc(view: EditorView, src: string): boolean {
  const found = imageOnLine(view)
  if (!found) return false
  const img = parseImage(found.text)
  if (!img) return false
  const next = parseMarkdownImage(found.text)
    ? toMarkdownImage({ ...img, src })
    : toHtmlImage({ ...img, src })
  view.dispatch({ changes: { from: found.from, to: found.to, insert: next } })
  view.focus()
  return true
}

/** The src of the image on the current line, if any. */
export function imageSrcOnLine(view: EditorView): string | null {
  const found = imageOnLine(view)
  return found ? (parseImage(found.text)?.src ?? null) : null
}

/** Insert the emoji glyph at the cursor. */
export function insertEmoji(view: EditorView, emoji: string): boolean {
  const pos = view.state.selection.main.head
  view.dispatch({ changes: { from: pos, insert: emoji }, selection: { anchor: pos + emoji.length } })
  view.focus()
  return true
}

/** Map a toolbar/menu action to its command. */
export function applyFormat(view: EditorView, action: FormatAction): boolean {
  switch (action) {
    case 'bold':
      return wrapSelection(view, '**')
    case 'italic':
      return wrapSelection(view, '*')
    case 'strike':
      return wrapSelection(view, '~~')
    case 'code':
      return wrapSelection(view, '`')
    case 'highlight':
      return wrapSelection(view, '==')
    case 'h1':
      return setHeading(view, 1)
    case 'h2':
      return setHeading(view, 2)
    case 'h3':
      return setHeading(view, 3)
    case 'quote':
      return toggleLines(view, /^>\s?/, () => '> ')
    case 'ul':
      return toggleLines(view, /^[-*+]\s+/, () => '- ')
    case 'ol':
      return toggleLines(view, /^\d+\.\s+/, (i) => `${i + 1}. `)
    case 'task':
      return toggleLines(view, /^[-*+]\s+\[[ xX]\]\s+/, () => '- [ ] ')
    case 'link':
      return insertLink(view)
    case 'image':
      return insertImage(view)
    case 'table':
      return insertBlock(view, '| Column 1 | Column 2 |\n| --- | --- |\n|   |   |\n', 2)
    case 'codeblock':
      return insertBlock(view, '```\n\n```\n', 4)
    case 'hr':
      return insertBlock(view, '---\n', 4)
    case 'toggleImageSyntax':
      return toggleImageSyntax(view)
    default:
      return false
  }
}
