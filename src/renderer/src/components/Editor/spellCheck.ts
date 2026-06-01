import {
  ViewPlugin,
  Decoration,
  EditorView,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { RangeSetBuilder, StateEffect, type EditorState, type Extension } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { useAppStore } from '@renderer/store/useAppStore'
import { hasCheckers, spellCorrect } from '@renderer/lib/spell'

/**
 * Spell-check decorations: underline misspelled words. Inline marks are legal
 * from a ViewPlugin (unlike block widgets), so this scans only the visible
 * ranges for performance. The pure `misspelledRanges` is unit tested; the plugin
 * skips code, gates on the setting, and recomputes when the checker (re)loads
 * via the `spellRefresh` effect.
 */

const WORD_RE = /[\p{L}][\p{L}'’]*/gu
const MISSPELLED = Decoration.mark({ class: 'ink-misspelled' })

/** Dispatch to force the plugin to recompute (checker ready / setting changed). */
export const spellRefresh = StateEffect.define<null>()

/** Misspelled word ranges within `text` (offset by `base`). Pure — unit tested. */
export function misspelledRanges(
  text: string,
  base: number,
  check: (word: string) => boolean
): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = []
  for (const m of text.matchAll(WORD_RE)) {
    const word = m[0]
    if (word.length < 2 || check(word)) continue
    out.push({ from: base + m.index, to: base + m.index + word.length })
  }
  return out
}

function inCode(view: EditorView, pos: number): boolean {
  for (let n: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, 1); n; n = n.parent) {
    if (/Code/.test(n.name)) return true
  }
  return false
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  if (!useAppStore.getState().spellCheck || !hasCheckers()) return builder.finish()
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to)
    for (const r of misspelledRanges(text, from, spellCorrect)) {
      if (!inCode(view, r.from)) builder.add(r.from, r.to, MISSPELLED)
    }
  }
  return builder.finish()
}

/** The word range + text around a document position, if any. */
function wordAt(state: EditorState, pos: number): { from: number; to: number; text: string } | null {
  const line = state.doc.lineAt(pos)
  const rel = pos - line.from
  for (const m of line.text.matchAll(WORD_RE)) {
    const start = m.index
    const end = start + m[0].length
    if (rel >= start && rel <= end) return { from: line.from + start, to: line.from + end, text: m[0] }
  }
  return null
}

/**
 * Right-clicking a misspelled word opens the suggestions menu. We emit a window
 * event with the word + range + screen position; `SpellMenu` renders the menu.
 */
export const spellContextMenu: Extension = EditorView.domEventHandlers({
  contextmenu(event, view) {
    if (!useAppStore.getState().spellCheck || !hasCheckers()) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return false
    const word = wordAt(view.state, pos)
    if (!word || spellCorrect(word.text)) return false
    event.preventDefault()
    window.dispatchEvent(
      new CustomEvent('ink:spell-menu', {
        detail: { ...word, x: event.clientX, y: event.clientY }
      })
    )
    return true
  }
})

export const spellCheckPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate): void {
      const refresh = u.transactions.some((t) => t.effects.some((e) => e.is(spellRefresh)))
      if (u.docChanged || u.viewportChanged || refresh) this.decorations = build(u.view)
    }
  },
  { decorations: (v) => v.decorations }
)
