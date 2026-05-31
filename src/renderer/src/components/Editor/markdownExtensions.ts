import {
  markdown,
  markdownLanguage,
  insertNewlineContinueMarkup,
  deleteMarkupBackward
} from '@codemirror/lang-markdown'
import { Subscript, Superscript } from '@lezer/markdown'
import { languages } from '@codemirror/language-data'
import { EditorView, drawSelection, highlightActiveLine, keymap, type Command } from '@codemirror/view'
import { type Extension, Prec, EditorSelection, EditorState } from '@codemirror/state'
import {
  indentMore,
  indentLess,
  selectLine,
  selectParentSyntax,
  addCursorAbove,
  addCursorBelow
} from '@codemirror/commands'
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { search, searchKeymap, selectNextOccurrence } from '@codemirror/search'
import { inkTheme, inkHighlight } from './theme'
import { emojiCompletion } from './livePreview'
import { imagePaste } from './imagePaste'
import {
  previewCompartment,
  previewExtensions,
  typewriterCompartment
} from './editorModes'

/** Select the word(s) under each cursor. */
export const selectWord: Command = (view) => {
  const ranges = view.state.selection.ranges.map((r) => view.state.wordAt(r.head) ?? r)
  view.dispatch({ selection: EditorSelection.create(ranges) })
  return true
}

/** Select the sentence around the cursor (within its line). */
export const selectSentence: Command = (view) => {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const rel = state.selection.main.head - line.from
  const re = /[.!?]+\s+/g
  let start = 0
  let end = line.text.length
  let m: RegExpExecArray | null
  while ((m = re.exec(line.text)) !== null) {
    const after = m.index + m[0].length
    if (after <= rel) start = after
    else {
      end = m.index + 1
      break
    }
  }
  view.dispatch({ selection: EditorSelection.single(line.from + start, line.from + end) })
  return true
}

/**
 * Block "input rules": pressing Enter at the end of a trigger line scaffolds a
 * block, Typora-style. Returns true (handled) when a rule fires, otherwise
 * false so the normal Enter handling (list/quote continuation) runs.
 *   |a|b|   -> a GFM table (header + separator + empty body row)
 *   ```lang -> a fenced code block with the caret inside
 *   $$      -> a math block with the caret inside
 */
export const blockInputRules: Command = (view) => {
  const { state } = view
  const { from, to, empty } = state.selection.main
  if (!empty) return false
  const line = state.doc.lineAt(from)
  if (to !== line.to) return false // only at end of line
  const text = line.text

  // Table header: | a | b |  (skip if a separator row already follows).
  const table = /^\|(.+)\|\s*$/.exec(text)
  if (table) {
    const below = line.number < state.doc.lines ? state.doc.line(line.number + 1).text : ''
    const isSep = /^\s*\|?[\s:|-]+\|?\s*$/.test(below) && below.includes('-')
    if (!isSep) {
      const cols = table[1].split('|').length
      const sep = '|' + ' --- |'.repeat(cols)
      const body = '|' + '   |'.repeat(cols)
      view.dispatch({
        changes: { from: line.to, insert: '\n' + sep + '\n' + body },
        selection: { anchor: line.to + 1 + sep.length + 1 + 1 } // first body cell
      })
      return true
    }
  }

  // Fenced code block: ``` or ```lang
  const fence = /^(`{3,})([a-zA-Z0-9+#-]*)$/.exec(text)
  if (fence) {
    view.dispatch({
      changes: { from: line.to, insert: '\n\n' + fence[1] },
      selection: { anchor: line.to + 1 }
    })
    return true
  }

  // Math block: $$
  if (text === '$$') {
    view.dispatch({
      changes: { from: line.to, insert: '\n\n$$' },
      selection: { anchor: line.to + 1 }
    })
    return true
  }

  return false
}

/**
 * The full extension stack for an Inkwell editor instance.
 * `onChange` is called (debounced by CM's own batching) on every doc edit.
 */
export function inkwellExtensions(onChange: (value: string) => void): Extension[] {
  return [
    markdown({
      base: markdownLanguage, // GitHub-flavored markdown
      codeLanguages: languages, // lazy-load highlighting for fenced code
      extensions: [Subscript, Superscript] // ~sub~ and ^sup^
    }),
    inkTheme,
    inkHighlight,
    // Multiple cursors: draw all selection ranges + allow more than one. Add a
    // cursor with Alt-click, Ctrl/Cmd+D (next occurrence), Ctrl/Cmd+Alt+↑/↓.
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    // Live preview + link-click; toggled off in Source Code Mode.
    previewCompartment.of(previewExtensions),
    // Typewriter mode; empty until enabled.
    typewriterCompartment.of([]),
    imagePaste,
    // Auto-pair brackets/quotes and common markdown symbols (wraps a selection).
    markdownLanguage.data.of({
      closeBrackets: { brackets: ['(', '[', '{', "'", '"', '`', '*', '_', '~'] }
    }),
    closeBrackets(),
    autocompletion({ override: [emojiCompletion] }),
    search({ top: true }),
    // Editing "magic": continue lists/quotes on Enter, smart Backspace, Tab to
    // indent, and smart-selection commands. High precedence to beat the defaults.
    Prec.high(
      keymap.of([
        { key: 'Enter', run: blockInputRules },
        { key: 'Enter', run: insertNewlineContinueMarkup },
        { key: 'Backspace', run: deleteMarkupBackward },
        { key: 'Tab', run: indentMore, shift: indentLess },
        { key: 'Mod-l', run: selectLine },
        { key: 'Alt-w', run: selectWord },
        { key: 'Alt-s', run: selectSentence },
        { key: 'Alt-ArrowUp', run: selectParentSyntax },
        // Multiple cursors.
        { key: 'Mod-d', run: selectNextOccurrence },
        { key: 'Mod-Alt-ArrowUp', run: addCursorAbove },
        { key: 'Mod-Alt-ArrowDown', run: addCursorBelow },
        ...closeBracketsKeymap,
        ...searchKeymap
      ])
    ),
    highlightActiveLine(),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString())
    })
  ]
}
