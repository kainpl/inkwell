import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { search, searchKeymap, openSearchPanel } from '@codemirror/search'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers
} from '@codemirror/view'
import { Compartment, Prec, type Extension } from '@codemirror/state'
import { Subscript, Superscript } from '@lezer/markdown'
import { inkTheme, inkHighlight } from './theme'
import { emojiCompletion, livePreview, openLinksOnClick } from './livePreview'
import { floatingToolbar } from './floatingToolbar'

export const modeCompartment = new Compartment()

export function modeExtensions(sourceMode: boolean): Extension {
  return sourceMode
    ? [lineNumbers(), EditorView.editorAttributes.of({ class: 'ink-source' })]
    : [livePreview, openLinksOnClick, floatingToolbar]
}

export function inkwellExtensions(sourceMode: boolean): Extension[] {
  return [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: [Subscript, Superscript]
    }),
    inkTheme,
    inkHighlight,
    modeCompartment.of(modeExtensions(sourceMode)),
    history(),
    drawSelection(),
    autocompletion({ override: [emojiCompletion] }),
    search({ top: true }),
    Prec.high(keymap.of(completionKeymap)),
    keymap.of([
      ...historyKeymap.filter((k) => k.run !== undo && k.run !== redo),
      ...searchKeymap.filter((k) => k.run !== openSearchPanel),
      ...defaultKeymap.filter((k) => k.key !== 'Mod-i')
    ]),
    highlightActiveLine(),
    EditorView.lineWrapping
  ]
}
