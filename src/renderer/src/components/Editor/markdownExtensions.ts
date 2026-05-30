import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView, highlightActiveLine } from '@codemirror/view'
import { type Extension } from '@codemirror/state'
import { inkTheme, inkHighlight } from './theme'
import { livePreview } from './livePreview'

/**
 * The full extension stack for an Inkwell editor instance.
 * `onChange` is called (debounced by CM's own batching) on every doc edit.
 */
export function inkwellExtensions(onChange: (value: string) => void): Extension[] {
  return [
    markdown({
      base: markdownLanguage, // GitHub-flavored markdown
      codeLanguages: languages // lazy-load highlighting for fenced code
    }),
    inkTheme,
    inkHighlight,
    livePreview,
    highlightActiveLine(),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString())
    })
  ]
}
