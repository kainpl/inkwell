import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * A minimal, transparent CodeMirror theme. Most visual styling lives in
 * index.css (.cm-*) so it can share theme tokens with the rest of the app.
 * This file only handles things that must be expressed as CM facets.
 */
export const inkTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgb(var(--accent) / 0.20) !important'
  }
})

/**
 * Syntax highlighting for raw tokens that remain visible (code blocks,
 * inline code, etc.). Headings/emphasis are handled by the live-preview
 * decorations instead, but we keep sensible colors here as a fallback.
 */
export const inkHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading, fontWeight: '700' },
    { tag: t.strong, fontWeight: '700' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: 'rgb(var(--accent))', textDecoration: 'underline' },
    { tag: t.monospace, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
    { tag: [t.processingInstruction, t.meta], color: 'rgb(var(--faint))' },
    { tag: t.comment, color: 'rgb(var(--faint))', fontStyle: 'italic' }
  ])
)
