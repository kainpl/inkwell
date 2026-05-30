import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import { Range, type EditorState, type Text } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { parseOutline } from '@renderer/lib/outline'
import { get as emojiGet, search as emojiSearch } from 'node-emoji'
import type { CompletionSource } from '@codemirror/autocomplete'

/**
 * The "seamless live preview" core (Typora's signature behaviour).
 *
 * Walk the Lezer markdown tree over the visible range and emit decorations that
 * (a) style content so it reads like a finished document and (b) HIDE the
 * markdown syntax markers — but only on lines the cursor is NOT on. Decoration
 * logic lives in the pure `buildDecorations(state, …)` so it can be unit tested
 * against an `EditorState` without a rendered viewport.
 */

const HEADING_CLASS: Record<string, string> = {
  ATXHeading1: 'ink-h1',
  ATXHeading2: 'ink-h2',
  ATXHeading3: 'ink-h3',
  ATXHeading4: 'ink-h4',
  ATXHeading5: 'ink-h5',
  ATXHeading6: 'ink-h6'
}

// Inline content nodes -> the class that styles them.
const CONTENT_CLASS: Record<string, string> = {
  StrongEmphasis: 'ink-strong',
  Emphasis: 'ink-em',
  Strikethrough: 'ink-strike',
  InlineCode: 'ink-code',
  Subscript: 'ink-sub',
  Superscript: 'ink-sup'
}

// Syntax marker node names that should be hidden when the line is inactive.
const MARK_NODES = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'StrikethroughMark',
  'LinkMark',
  'QuoteMark',
  'SubscriptMark',
  'SuperscriptMark'
])

// Bullet glyphs for unordered lists, cycled by nesting depth (Typora-style).
const BULLET_GLYPHS = ['•', '◦', '▪']

/** Renders a real bullet in place of the raw `-`/`*`/`+` marker. */
export class BulletWidget extends WidgetType {
  constructor(readonly glyph: string) {
    super()
  }
  eq(other: BulletWidget): boolean {
    return other.glyph === this.glyph
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'ink-bullet'
    span.textContent = this.glyph
    return span
  }
}

/** Clickable task checkbox that toggles `[ ]` <-> `[x]` in the source. */
export class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number
  ) {
    super()
  }
  eq(other: TaskCheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos
  }
  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = this.checked
    box.className = 'ink-task'
    box.setAttribute('aria-label', 'Toggle task')
    // Flip the char inside the brackets without moving the caret onto the line.
    box.onmousedown = (e): void => {
      e.preventDefault()
      const inner = this.pos + 1 // the ' ' or 'x' inside "[ ]" / "[x]"
      const cur = view.state.doc.sliceString(inner, inner + 1)
      view.dispatch({
        changes: { from: inner, to: inner + 1, insert: cur.toLowerCase() === 'x' ? ' ' : 'x' }
      })
    }
    return box
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Renders a horizontal rule in place of `---`/`***`/`___`. */
export class HrWidget extends WidgetType {
  eq(): boolean {
    return true
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'ink-hr'
    el.setAttribute('aria-hidden', 'true')
    return el
  }
}

/** Renders the emoji character in place of a `:shortcode:`. */
export class EmojiWidget extends WidgetType {
  constructor(readonly char: string) {
    super()
  }
  eq(other: EmojiWidget): boolean {
    return other.char === this.char
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'ink-emoji'
    span.textContent = this.char
    return span
  }
}

/** Nesting depth of a list node (1 = top level), counting list ancestors. */
function listDepth(node: SyntaxNodeRef): number {
  let depth = 0
  let cur = node.node.parent
  while (cur) {
    if (cur.name === 'BulletList' || cur.name === 'OrderedList') depth++
    cur = cur.parent
  }
  return depth
}

/** Line numbers (1-based) that contain part of a selection range. */
export function activeLines(view: EditorView): Set<number> {
  const lines = new Set<number>()
  for (const range of view.state.selection.ranges) {
    const a = view.state.doc.lineAt(range.from).number
    const b = view.state.doc.lineAt(range.to).number
    for (let n = a; n <= b; n++) lines.add(n)
  }
  return lines
}

// ---- Link helpers (ctrl/cmd-click navigation) ----

/** GitHub-style heading slug. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** Document offset of the heading whose slug matches `slug`, or null. */
export function headingOffset(state: EditorState, slug: string): number | null {
  const target = slug.toLowerCase()
  const h = parseOutline(state.doc.toString()).find((x) => slugify(x.text) === target)
  return h ? h.from : null
}

/** Resolve a reference-link id against its `[id]: url` definition. */
function resolveReference(docText: string, id: string): string | null {
  if (!id) return null
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = docText.match(new RegExp('^ {0,3}\\[' + esc + '\\]:\\s*<?([^\\s>]+)', 'mi'))
  return m ? m[1] : null
}

/** URL/target of the link at `pos` — inline, reference, autolink or bare URL. */
export function linkUrlAt(state: EditorState, pos: number): string | null {
  const doc = state.doc
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1)
  while (node && node.name !== 'Link' && node.name !== 'Autolink' && node.name !== 'URL') {
    node = node.parent
  }
  if (!node) return null

  // Autolink <url> or a bare/auto URL: the text is the target.
  if (node.name === 'Autolink' || node.name === 'URL') {
    return doc.sliceString(node.from, node.to).replace(/^<|>$/g, '')
  }

  // Inline link [label](url).
  const url = node.getChild('URL')
  if (url) return doc.sliceString(url.from, url.to)

  // Reference link [label][id] / [label][] / [label]: resolve the definition.
  const labels = node.getChildren('LinkLabel')
  let id = labels.length
    ? doc.sliceString(labels[labels.length - 1].from, labels[labels.length - 1].to)
    : ''
  id = id.replace(/^\[|\]$/g, '').trim()
  if (!id) id = doc.sliceString(node.from, node.to).replace(/^\[|\][\s\S]*$/g, '').trim()
  return resolveReference(doc.toString(), id)
}

/** Ctrl/Cmd-click a link: open external URLs, or scroll to internal #anchors. */
export const openLinksOnClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!event.metaKey && !event.ctrlKey) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return false
    const url = linkUrlAt(view.state, pos)
    if (!url) return false
    event.preventDefault()
    if (url.startsWith('#')) {
      const target = headingOffset(view.state, url.slice(1))
      if (target != null) {
        view.dispatch({
          selection: { anchor: target },
          effects: EditorView.scrollIntoView(target, { y: 'start' })
        })
        view.focus()
      }
    } else {
      window.open(url, '_blank', 'noopener')
    }
    return true
  }
})

// ---- Emoji (:shortcode: rendering + autocomplete) ----

const EMOJI_RE = /:([a-z0-9_+-]+):/g

/** Replace `:shortcode:` with the emoji glyph on idle lines. */
function emojiDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  out: Range<Decoration>[]
): void {
  EMOJI_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = EMOJI_RE.exec(text)) !== null) {
    const char = emojiGet(m[1])
    if (!char || char.includes(':')) continue
    const start = base + m.index
    if (active.has(doc.lineAt(start).number)) continue
    out.push(
      Decoration.replace({ widget: new EmojiWidget(char) }).range(start, start + m[0].length)
    )
  }
}

/** Autocomplete `:shortcode` -> emoji (inserts the glyph). */
export const emojiCompletion: CompletionSource = (ctx) => {
  const token = ctx.matchBefore(/:[a-z0-9_+-]*/)
  if (!token || (token.from === token.to && !ctx.explicit)) return null
  const query = token.text.slice(1)
  if (!query) return null
  const matches = emojiSearch(query).slice(0, 12)
  if (!matches.length) return null
  return {
    from: token.from,
    options: matches.map((r) => ({ label: ':' + r.name + ':', detail: r.emoji, apply: r.emoji }))
  }
}

// Inline syntaxes Lezer doesn't parse: <u>underline</u>, ==highlight==, <!--comments-->.
const INLINE_RULES: { re: RegExp; cls: string | null; open: number; close: number }[] = [
  { re: /<u>([\s\S]+?)<\/u>/gi, cls: 'ink-u', open: 3, close: 4 },
  { re: /==([^=\n]+)==/g, cls: 'ink-highlight', open: 2, close: 2 },
  { re: /<!--[\s\S]*?-->/g, cls: null, open: 4, close: 3 } // comment: hide entirely
]

/** Decorate regex-only inline syntaxes (underline / highlight / comment). */
function inlineRegexDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  out: Range<Decoration>[]
): void {
  for (const { re, cls, open, close } of INLINE_RULES) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const start = base + m.index
      const end = start + m[0].length
      const lineActive = active.has(doc.lineAt(start).number)
      if (cls === null) {
        if (!lineActive) out.push(Decoration.replace({}).range(start, end))
        continue
      }
      const contentStart = start + open
      const contentEnd = end - close
      if (lineActive) {
        out.push(Decoration.mark({ class: cls }).range(contentStart, contentEnd))
      } else {
        out.push(Decoration.replace({}).range(start, contentStart))
        out.push(Decoration.mark({ class: cls }).range(contentStart, contentEnd))
        out.push(Decoration.replace({}).range(contentEnd, end))
      }
    }
  }
}

/**
 * Pure decoration builder. Takes the editor `state`, the document `ranges` to
 * scan, and the set of active line numbers; returns the decoration set.
 */
export function buildDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
  active: Set<number>
): DecorationSet {
  const decos: Range<Decoration>[] = []
  const doc = state.doc

  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name

        // 1) Headings: tag the whole line so CSS can resize it.
        if (HEADING_CLASS[name]) {
          const line = doc.lineAt(node.from)
          decos.push(Decoration.line({ class: HEADING_CLASS[name] }).range(line.from))
          return
        }

        // 2) Inline content styling.
        if (CONTENT_CLASS[name]) {
          decos.push(Decoration.mark({ class: CONTENT_CLASS[name] }).range(node.from, node.to))
          return
        }

        // 3) Links: style the visible label; URL/marks are hidden below.
        if (name === 'Link') {
          decos.push(Decoration.mark({ class: 'ink-link' }).range(node.from, node.to))
          return
        }

        // 3a) Autolink <url>: style it; the < > marks are hidden by MARK_NODES.
        if (name === 'Autolink') {
          decos.push(Decoration.mark({ class: 'ink-link' }).range(node.from, node.to))
          return
        }

        // 4) List markers: bullet widget for unordered, styled number for
        //    ordered, nothing for task items (the checkbox stands in). Raw
        //    (dimmed) on the active line so it stays editable.
        if (name === 'ListMark') {
          const line = doc.lineAt(node.from)
          decos.push(Decoration.line({ class: 'ink-li' }).range(line.from))

          const rest = doc.sliceString(node.to, line.to).replace(/^\s+/, '')
          const isTask = /^\[[ xX]\]/.test(rest)
          const ordered = /\d/.test(doc.sliceString(node.from, node.to))

          if (active.has(line.number)) {
            decos.push(Decoration.mark({ class: 'ink-mark' }).range(node.from, node.to))
          } else if (isTask) {
            decos.push(Decoration.replace({}).range(node.from, node.to))
          } else if (ordered) {
            decos.push(Decoration.mark({ class: 'ink-list-number' }).range(node.from, node.to))
          } else {
            const glyph = BULLET_GLYPHS[(listDepth(node) - 1) % BULLET_GLYPHS.length]
            decos.push(
              Decoration.replace({ widget: new BulletWidget(glyph) }).range(node.from, node.to)
            )
          }
          return
        }

        // 4a) Task marker `[ ]`/`[x]` -> clickable checkbox (raw on active line).
        if (name === 'TaskMarker') {
          const lineNo = doc.lineAt(node.from).number
          if (active.has(lineNo)) {
            decos.push(Decoration.mark({ class: 'ink-mark' }).range(node.from, node.to))
          } else {
            const checked = /x/i.test(doc.sliceString(node.from, node.to))
            decos.push(
              Decoration.replace({ widget: new TaskCheckboxWidget(checked, node.from) }).range(
                node.from,
                node.to
              )
            )
          }
          return
        }

        // 4b) Blockquote: style every line of the quote (left bar, indent, muted
        //     text via .cm-blockquote). The `>` marker is hidden by MARK_NODES.
        if (name === 'Blockquote') {
          const first = doc.lineAt(node.from).number
          const last = doc.lineAt(node.to).number
          for (let ln = first; ln <= last; ln++) {
            decos.push(Decoration.line({ class: 'cm-blockquote' }).range(doc.line(ln).from))
          }
          return
        }

        // 4c) Horizontal rule -> a rendered line (raw on the active line).
        if (name === 'HorizontalRule') {
          if (!active.has(doc.lineAt(node.from).number)) {
            decos.push(Decoration.replace({ widget: new HrWidget() }).range(node.from, node.to))
          }
          return
        }

        // 4d) URL: hide an inline-link URL (keep the label); style a bare/auto
        //     URL as a link. Raw on the active line.
        if (name === 'URL') {
          const lineNo = doc.lineAt(node.from).number
          if (!active.has(lineNo)) {
            if (node.node.parent?.name === 'Link') {
              decos.push(Decoration.replace({}).range(node.from, node.to))
            } else {
              decos.push(Decoration.mark({ class: 'ink-link' }).range(node.from, node.to))
            }
          }
          return
        }

        // 4e) Reference label: hide the `[id]` of `[label][id]` (not the visible
        //     shortcut label, which sits right after the link's opening `[`).
        if (name === 'LinkLabel') {
          const parent = node.node.parent
          const lineNo = doc.lineAt(node.from).number
          if (!active.has(lineNo) && parent?.name === 'Link' && node.from > parent.from + 1) {
            decos.push(Decoration.replace({}).range(node.from, node.to))
          }
          return
        }

        // 5) Syntax markers: hide on inactive lines, dim on active ones.
        if (MARK_NODES.has(name)) {
          const lineNo = doc.lineAt(node.from).number
          if (active.has(lineNo)) {
            decos.push(Decoration.mark({ class: 'ink-mark' }).range(node.from, node.to))
          } else if (node.to > node.from) {
            decos.push(Decoration.replace({}).range(node.from, node.to))
          }
        }
      }
    })
    const slice = doc.sliceString(from, to)
    inlineRegexDecos(slice, from, active, doc, decos)
    emojiDecos(slice, from, active, doc, decos)
  }

  // RangeSet must be sorted by position; `true` lets CodeMirror sort for us.
  return Decoration.set(decos, true)
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state, view.visibleRanges, activeLines(view))
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(
          update.view.state,
          update.view.visibleRanges,
          activeLines(update.view)
        )
      }
    }
  },
  { decorations: (v) => v.decorations }
)
