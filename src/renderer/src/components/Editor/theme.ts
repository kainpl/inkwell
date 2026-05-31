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
  },
  // The editor "page" surface. These properties compete with CodeMirror's own
  // baseTheme (notably `.cm-scroller { font-family: monospace }`), which CM injects
  // at higher specificity (`.ͼN .cm-scroller`) than a bare `.cm-*` rule in
  // index.css can reach — so they MUST live in the theme facet to take effect.
  // The actual values come from Preferences via CSS variables (see settingsSync.ts).
  '.cm-scroller': {
    fontFamily: 'var(--ink-editor-font, ui-serif, Georgia, serif)',
    lineHeight: 'var(--ink-editor-leading, 1.75)',
    padding: '4rem 0'
  },
  '.cm-content': {
    maxWidth: 'var(--ink-content-width, 46rem)',
    margin: '0 auto',
    padding: '0 1.5rem',
    fontSize: 'var(--ink-editor-size, 1.0625rem)',
    caretColor: 'rgb(var(--accent))'
  }
})

/**
 * Syntax highlighting for raw tokens that remain visible (code blocks,
 * inline code, etc.). Headings/emphasis are handled by the live-preview
 * decorations instead, but we keep sensible colors here as a fallback.
 */
export const inkHighlight = syntaxHighlighting(
  HighlightStyle.define([
    // Markdown tokens that stay visible.
    { tag: t.heading, fontWeight: '700' },
    { tag: t.strong, fontWeight: '700' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: 'rgb(var(--accent))', textDecoration: 'underline' },
    { tag: t.monospace, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
    // Fenced-code syntax highlighting (nested languages via codeLanguages).
    {
      tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword, t.modifier, t.self],
      color: 'rgb(var(--syn-keyword))'
    },
    {
      tag: [t.string, t.special(t.string), t.regexp, t.escape, t.character],
      color: 'rgb(var(--syn-string))'
    },
    { tag: [t.number, t.integer, t.float], color: 'rgb(var(--syn-number))' },
    { tag: [t.bool, t.null, t.atom, t.literal], color: 'rgb(var(--syn-literal))' },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName), t.labelName],
      color: 'rgb(var(--syn-name))'
    },
    { tag: [t.typeName, t.className, t.namespace, t.tagName], color: 'rgb(var(--syn-type))' },
    { tag: [t.processingInstruction, t.meta], color: 'rgb(var(--faint))' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: 'rgb(var(--faint))', fontStyle: 'italic' }
  ])
)
