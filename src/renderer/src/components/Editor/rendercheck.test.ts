import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { Subscript, Superscript } from '@lezer/markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { livePreview } from './livePreview'

function mountAndRender(doc: string): { error: string | null } {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage, extensions: [Subscript, Superscript] }), livePreview]
  })
  ensureSyntaxTree(state, state.doc.length, 8000)
  let error: string | null = null
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  try {
    const view = new EditorView({ state, parent })
    // Force a layout/decoration pass.
    view.requestMeasure()
    ;(view as unknown as { measure: (flush?: boolean) => void }).measure(false)
    view.destroy()
  } catch (e) {
    error = (e as Error).message
  }
  return { error }
}

// Regression: block widgets / line-break-spanning replacements must come from
// a StateField, not a ViewPlugin, or CodeMirror throws at render time.
it('renders a multi-line block math without throwing', () => {
  expect(mountAndRender('text\n\n$$\n\\int_0^1 x\\,dx\n$$\n\nmore').error).toBeNull()
})

it('renders a GFM table without throwing', () => {
  expect(mountAndRender('text\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nmore').error).toBeNull()
})

it('renders an HTML block and a mermaid fence without throwing', () => {
  expect(mountAndRender('text\n\n<div>\n  <p>hi</p>\n</div>\n\nmore').error).toBeNull()
  expect(mountAndRender('text\n\n```mermaid\ngraph LR\n A-->B\n```\n\nmore').error).toBeNull()
})

it('renders the full welcome document without throwing', () => {
  const welcome = readFileSync(resolve('resources/Welcome.md'), 'utf-8')
  expect(mountAndRender(welcome).error).toBeNull()
})
