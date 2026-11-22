import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'

/**
 * Smart punctuation: convert straight quotes/dashes/ellipsis to typographic
 * characters as you type. The pure `smartReplace` is the testable core; the
 * `smartPunctuation` extension wires it to CodeMirror input, skipping code.
 */

const OPEN_BEFORE = /[\s([{]/

/**
 * Given the up-to-2 characters before the caret and the just-typed character,
 * return the typographic substitution: `insert` replaces the typed char plus
 * `from` of the preceding characters. Returns null when nothing should change.
 */
export function smartReplace(before: string, ch: string): { from: number; insert: string } | null {
  const prev = before.slice(-1)
  switch (ch) {
    case '"':
      return { from: 0, insert: prev === '' || OPEN_BEFORE.test(prev) ? '“' : '”' }
    case "'":
      return { from: 0, insert: prev === '' || OPEN_BEFORE.test(prev) ? '‘' : '’' }
    case '-':
      if (prev === '–') return { from: 1, insert: '—' } // – + - → — (em)
      if (prev === '-') return { from: 1, insert: '–' } // - + - → – (en)
      return null
    case '.':
      if (before.slice(-2) === '..') return { from: 2, insert: '…' } // ... → …
      return null
    default:
      return null
  }
}

/** True when the position sits inside a code node (where punctuation is literal). */
function inCode(node: SyntaxNode | null): boolean {
  for (let n = node; n; n = n.parent) {
    if (/Code|URL|HTML/.test(n.name)) return true
  }
  return false
}

/** CodeMirror extension applying smart punctuation when the setting is on. */
export function smartPunctuation(): Extension {
  return EditorView.inputHandler.of((view, from, to, text) => {
    if (from !== to || text.length !== 1 || !'"\'-.'.includes(text)) return false
    const prefix = view.state.sliceDoc(view.state.doc.lineAt(from).from, from)
    if (text === '-' && /^(?:\s*[-:| ]*|.*\|[-:| ]*)$/.test(prefix)) return false
    if (inCode(syntaxTree(view.state).resolve(from, -1))) return false

    const r = smartReplace(view.state.sliceDoc(Math.max(0, from - 2), from), text)
    if (!r) return false
    view.dispatch({
      changes: { from: from - r.from, to, insert: r.insert },
      selection: { anchor: from - r.from + r.insert.length },
      userEvent: 'input.type'
    })
    return true
  })
}
