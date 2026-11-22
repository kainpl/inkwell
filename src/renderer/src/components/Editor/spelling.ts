import { invoke } from '@tauri-apps/api/core'
import { syntaxTree } from '@codemirror/language'
import { StateEffect, type Range } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { translate } from '@renderer/lib/i18n'
import { useAppStore } from '@renderer/store/useAppStore'

const result = StateEffect.define<DecorationSet>()
const mark = Decoration.mark({ class: 'ink-misspelled' })
const wordPattern = /\p{L}+(?:['’ʼ-]\p{L}+)*/gu

function prose(view: EditorView, pos: number) {
  for (let n: SyntaxNode | null = syntaxTree(view.state).resolve(pos, 1); n; n = n.parent)
    if (/Code|URL|HTML|LinkDestination/.test(n.name)) return false
  return true
}

class Spelling {
  decorations = Decoration.none
  private version = 0
  private timer?: ReturnType<typeof setTimeout>
  private menu?: HTMLElement
  constructor(readonly view: EditorView) {
    this.schedule()
  }
  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.decorations.map(update.changes)
      this.dismiss()
      this.schedule()
    }
    for (const tr of update.transactions)
      for (const effect of tr.effects) if (effect.is(result)) this.decorations = effect.value
  }
  private schedule() {
    const version = ++this.version
    clearTimeout(this.timer)
    this.timer = setTimeout(
      () => void this.check(version).catch((e) => this.error(version, e)),
      230
    )
  }
  private error(version: number, error: unknown) {
    if (version === this.version) useAppStore.setState({ spellError: String(error) })
  }
  private async check(version: number) {
    const { spellLanguages: languages, personalWords } = useAppStore.getState()
    const allowed = new Set(personalWords.map((w) => w.toLowerCase()))
    const ranges = new Map<string, { from: number; to: number }[]>()
    for (const { from, to } of this.view.visibleRanges) {
      for (const m of this.view.state.sliceDoc(from, to).matchAll(wordPattern)) {
        const word = m[0],
          start = from + m.index
        if (allowed.has(word.toLowerCase()) || !prose(this.view, start)) continue
        const list = ranges.get(word) ?? []
        list.push({ from: start, to: start + word.length })
        ranges.set(word, list)
      }
    }
    const words = [...ranges.keys()]
    const bad = words.length ? await invoke<string[]>('misspellings', { words, languages }) : []
    if (version !== this.version) return
    const marks: Range<Decoration>[] = []
    for (const word of bad)
      for (const range of ranges.get(word) ?? []) marks.push(mark.range(range.from, range.to))
    useAppStore.setState({ spellError: null })
    this.view.dispatch({ effects: result.of(Decoration.set(marks, true)) })
  }
  private dismiss = () => {
    this.menu?.remove()
    this.menu = undefined
    document.removeEventListener('pointerdown', this.outside, true)
    document.removeEventListener('keydown', this.escape, true)
  }
  private outside = (e: Event) => {
    if (!this.menu?.contains(e.target as Node)) this.dismiss()
  }
  private escape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.dismiss()
      this.view.focus()
    }
  }
  context(event: MouseEvent) {
    const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return false
    const iter = this.decorations.iter(Math.max(0, pos - 1))
    while (iter.value && iter.to < pos) iter.next()
    if (!iter.value || iter.from > pos) return false
    const { from, to } = iter
    const word = this.view.state.sliceDoc(from, to)
    const snapshot = this.view.state.doc
    const { spellLanguages: languages } = useAppStore.getState()
    event.preventDefault()
    this.dismiss()
    const menu = document.createElement('div')
    this.menu = menu
    menu.className = 'spell-menu'
    const button = (label: string, run: () => void) => {
      const element = document.createElement('button')
      element.textContent = label
      element.onclick = () => {
        this.dismiss()
        if (snapshot === this.view.state.doc) run()
        this.view.focus()
      }
      return element
    }
    menu.append(
      button(translate('Add to dictionary'), () => {
        const s = useAppStore.getState()
        s.configure({ personalWords: [...new Set([...s.personalWords, word])] })
      })
    )
    document.body.append(menu)
    const place = () => {
      menu.style.left = Math.max(0, Math.min(event.clientX, innerWidth - menu.offsetWidth)) + 'px'
      menu.style.top = Math.max(0, Math.min(event.clientY, innerHeight - menu.offsetHeight)) + 'px'
    }
    place()
    document.addEventListener('pointerdown', this.outside, true)
    document.addEventListener('keydown', this.escape, true)
    const version = this.version
    void invoke<string[]>('suggestions', { word, languages })
      .then((words) => {
        if (this.menu !== menu) return
        if (words.length)
          menu.prepend(
            ...words.map((insert) =>
              button(insert, () =>
                this.view.dispatch({ changes: { from, to, insert }, userEvent: 'input.replace' })
              )
            )
          )
        else {
          const note = document.createElement('span')
          note.textContent = translate('No suggestions')
          menu.prepend(note)
        }
        place()
      })
      .catch((e) => this.error(version, e))
    return true
  }
  destroy() {
    ++this.version
    clearTimeout(this.timer)
    this.dismiss()
  }
}

// Each spelling configuration owns its pending requests and decorations.
export function spellingExtension() {
  return ViewPlugin.fromClass(Spelling, {
    decorations: (v) => v.decorations,
    eventHandlers: {
      contextmenu(event) {
        return this.context(event)
      }
    }
  })
}
