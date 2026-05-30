import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import { Range, type EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'

/**
 * The "seamless live preview" core (Typora's signature behaviour).
 *
 * Strategy: walk the Lezer markdown tree over the visible range and emit
 * decorations that (a) style content so it reads like a finished document
 * and (b) HIDE the markdown syntax markers — but only on lines the cursor
 * is NOT on. When you move the caret onto a line, its markers reappear
 * (dimmed) so you can edit them. That reveal-on-active-line behaviour is
 * what makes the editor feel like a word processor with markdown underneath.
 *
 * The decoration logic lives in the pure `buildDecorations(state, …)` so it
 * can be unit tested against an `EditorState` without a rendered viewport.
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
  InlineCode: 'ink-code'
}

// Syntax marker node names that should be hidden when the line is inactive.
const MARK_NODES = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'StrikethroughMark',
  'LinkMark',
  'QuoteMark'
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

/**
 * Pure decoration builder. Takes the editor `state`, the document `ranges` to
 * scan, and the set of active line numbers; returns the decoration set. Kept
 * free of `EditorView` so it can be unit tested headlessly.
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

        // 3) Links: style the visible label; the URL/marks are hidden below.
        if (name === 'Link') {
          decos.push(Decoration.mark({ class: 'ink-link' }).range(node.from, node.to))
          return
        }

        // 4) List markers: bullet widget for unordered, styled number for
        //    ordered; raw (dimmed) on the active line so it stays editable.
        if (name === 'ListMark') {
          const line = doc.lineAt(node.from)
          // Hanging indent so wrapped lines align under the item text.
          decos.push(Decoration.line({ class: 'ink-li' }).range(line.from))

          const ordered = /\d/.test(doc.sliceString(node.from, node.to))
          if (ordered) {
            decos.push(
              Decoration.mark({ class: 'ink-list-number' }).range(node.from, node.to)
            )
          } else if (active.has(line.number)) {
            decos.push(Decoration.mark({ class: 'ink-mark' }).range(node.from, node.to))
          } else {
            const glyph = BULLET_GLYPHS[(listDepth(node) - 1) % BULLET_GLYPHS.length]
            decos.push(
              Decoration.replace({ widget: new BulletWidget(glyph) }).range(node.from, node.to)
            )
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
