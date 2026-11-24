import { insertNewlineContinueMarkup, markdown, markdownLanguage } from '@codemirror/lang-markdown'
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
import { emojiCompletion, livePreview, openLinksOnClick, visualEditing } from './livePreview'
import { floatingToolbar } from './floatingToolbar'
import type { EditorMode } from '@renderer/lib/settings'

export const modeCompartment = new Compartment()

export function modeExtensions(mode: EditorMode): Extension {
  if (mode === 'source') {
    return [lineNumbers(), EditorView.editorAttributes.of({ class: 'ink-source' })]
  }
  return [
    livePreview,
    openLinksOnClick,
    floatingToolbar,
    mode === 'visual'
      ? [visualEditing, Prec.high(keymap.of([{ key: 'Enter', run: insertNewlineContinueMarkup }]))]
      : []
  ]
}

export function inkwellExtensions(mode: EditorMode): Extension[] {
  return [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: [Subscript, Superscript]
    }),
    inkTheme,
    inkHighlight,
    modeCompartment.of(modeExtensions(mode)),
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
