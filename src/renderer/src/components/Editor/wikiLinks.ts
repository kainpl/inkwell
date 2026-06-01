import { Decoration, EditorView } from '@codemirror/view'
import type { EditorState, Text, Range } from '@codemirror/state'
import type { CompletionSource } from '@codemirror/autocomplete'
import { useAppStore } from '@renderer/store/useAppStore'
import { openWikiNote } from '@renderer/lib/wikiNote'

/**
 * Obsidian-style wiki-links `[[Note]]` / `[[Note|alias]]`: rendered as clickable
 * links (brackets hidden on idle lines), opened/created on Ctrl/Cmd-click, and
 * autocompleted from the workspace's notes. The pure parsers are unit tested.
 */

const WIKI = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g
const WIKI_CLASS = Decoration.mark({ class: 'ink-wikilink' })
const HIDE = Decoration.replace({})

/** Parse a single `[[…]]` token into its target + display text. */
export function parseWikiLink(text: string): { target: string; display: string } | null {
  const m = /^\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]$/.exec(text.trim())
  if (!m) return null
  return { target: m[1].trim(), display: (m[2] ?? m[1]).trim() }
}

/** The wiki-link target at a document position, if the position is inside one. */
export function wikiTargetAt(state: EditorState, pos: number): string | null {
  const line = state.doc.lineAt(pos)
  const rel = pos - line.from
  const re = new RegExp(WIKI.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(line.text)) !== null) {
    if (rel >= m.index && rel <= m.index + m[0].length) return m[1].trim()
  }
  return null
}

/** Decorations for wiki-links within `slice` (offset by `base`). */
export function wikiLinkDecos(
  slice: string,
  base: number,
  active: Set<number>,
  doc: Text,
  decos: Range<Decoration>[]
): void {
  const re = new RegExp(WIKI.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(slice)) !== null) {
    const start = base + m.index
    const end = start + m[0].length
    if (active.has(doc.lineAt(start).number)) continue // raw on the active line
    decos.push(HIDE.range(start, start + 2)) // hide '[['
    const aliasOffset = m[2] != null ? 2 + m[1].length + 1 : 2 // skip 'target|' if aliased
    if (m[2] != null) decos.push(HIDE.range(start + 2, start + aliasOffset))
    decos.push(WIKI_CLASS.range(start + aliasOffset, end - 2)) // style the visible text
    decos.push(HIDE.range(end - 2, end)) // hide ']]'
  }
}

/** Open/create the wiki-link under the caret on Ctrl/Cmd-click. */
export const wikiLinkClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!event.metaKey && !event.ctrlKey) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return false
    const target = wikiTargetAt(view.state, pos)
    if (!target) return false
    event.preventDefault()
    void openWikiNote(target)
    return true
  }
})

/** Autocomplete note names after `[[`. */
export const wikiLinkCompletion: CompletionSource = async (ctx) => {
  const token = ctx.matchBefore(/\[\[[^\]|\n]*/)
  if (!token || (token.from === token.to && !ctx.explicit)) return null
  const root = useAppStore.getState().root
  if (!root) return null
  const query = token.text.slice(2).toLowerCase()
  const articles = await window.api.listArticles(root.path)
  const names = [...new Set(articles.map((a) => a.name.replace(/\.md$/i, '')))]
  const matches = names.filter((n) => n.toLowerCase().includes(query)).slice(0, 20)
  if (!matches.length) return null
  return {
    from: token.from,
    options: matches.map((n) => ({ label: `[[${n}]]`, apply: `[[${n}]]` }))
  }
}
