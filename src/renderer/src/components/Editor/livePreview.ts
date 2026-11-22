import { DEFAULT_MARKDOWN_FEATURES, type MarkdownFeatures } from '@renderer/lib/markdownFeatures'
import { translate } from '@renderer/lib/i18n'
import { convertFileSrc } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Decoration, type DecorationSet, EditorView, WidgetType, drawSelection, keymap } from '@codemirror/view'
import { Range, RangeSet, Facet, StateField, EditorState, Prec, findClusterBreak, type Text } from '@codemirror/state'
import { standardKeymap } from '@codemirror/commands'
import { syntaxTree, syntaxTreeAvailable } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { Subscript, Superscript } from '@lezer/markdown'
import type { SyntaxNode, SyntaxNodeRef, Tree } from '@lezer/common'
import { parseOutline, revealInEditor } from '@renderer/lib/outline'
import { get as emojiGet, search as emojiSearch } from 'node-emoji'
import type { CompletionSource } from '@codemirror/autocomplete'
import MarkdownIt from 'markdown-it'
import { type ImageAlign, parseHtmlImage, parseMarkdownImage, parseImage, toHtmlImage } from './imageInput'
import katex from 'katex'
import { renderMermaid } from './mermaidRender'
import DOMPurify from 'dompurify'
import { floatingToolbar } from './floatingToolbar'
import { parseTable, tableCellChange } from './tableModel'
import { applyTable, applyTableAt, type TableAction } from './tableCommands'
import {
  createElement as createIcon,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Trash2,
  Trash,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide'

/**
 * The "seamless live preview" core (Typora's signature behaviour).
 *
 * Walk the Lezer Markdown tree over the requested ranges and emit decorations that
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
  ATXHeading6: 'ink-h6',
}

// Inline content nodes -> the class that styles them.
const CONTENT_CLASS: Record<string, string> = {
  StrongEmphasis: 'ink-strong',
  Emphasis: 'ink-em',
  Strikethrough: 'ink-strike',
  InlineCode: 'ink-code',
  Subscript: 'ink-sub',
  Superscript: 'ink-sup',
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
  'SuperscriptMark',
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
    readonly pos: number,
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
    box.setAttribute('aria-label', translate('Toggle task'))
    // Flip the char inside the brackets without moving the caret onto the line.
    box.onmousedown = (event): void => event.preventDefault()
    box.onchange = (): void => {
      const inner = this.pos + 1 // the ' ' or 'x' inside "[ ]" / "[x]"
      const cur = view.state.doc.sliceString(inner, inner + 1)
      view.dispatch({
        changes: { from: inner, to: inner + 1, insert: cur.toLowerCase() === 'x' ? ' ' : 'x' },
      })
    }
    return box
  }
  ignoreEvent(): boolean {
    return true
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

export function resolveImageSrc(src: string, docPath: string | null): string {
  const path = src.trim().replace(/\\/g, '/')
  if (/^https?:\/\//i.test(path) || /^data:image\//i.test(path)) return path
  if (!docPath || path.startsWith('//') || /^[a-z][\w+.-]*:/i.test(path) && !/^[a-z]:\//i.test(path)) return ''
  const dir = docPath.replace(/\\/g, '/').replace(/[^/]*$/, '')
  if (dir.startsWith('//')) return ''
  const base = 'ink-image://local/' + dir.replace(/^\//, '').split('/').map(encodeURIComponent).join('/')
  try {
    const resolved = new URL(/^[a-z]:\//i.test(path) ? '/' + path : path, base)
    const absolute = decodeURIComponent(resolved.pathname).replace(/^\/(?=[A-Za-z]:\/)/, '')
    return convertFileSrc(absolute, 'ink-image')
  } catch {
    return ''
  }
}

/** Rewrite the image at [from,to] as an HTML <img> with the given width. */
function writeImageWidth(view: EditorView, from: number, to: number, width: number): void {
  const text = view.state.doc.sliceString(from, to)
  const img = parseImage(text)
  if (!img) return
  const next = toHtmlImage({ ...img, width: Math.max(16, Math.round(width)) })
  view.dispatch({ changes: { from, to, insert: next } })
}

/** Rewrite the image at [from,to] as an HTML <img> with the given block alignment. */
function writeImageAlign(view: EditorView, from: number, to: number, align: ImageAlign): void {
  const text = view.state.doc.sliceString(from, to)
  const img = parseImage(text)
  if (!img) return
  const next = toHtmlImage({ ...img, align: img.align === align ? undefined : align })
  view.dispatch({ changes: { from, to, insert: next } })
}

/** Renders an image in place of `![alt](src)` / `<img>` on idle lines. */
export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly docPath: string | null,
    readonly width: number | undefined,
    readonly from: number,
    readonly to: number,
    readonly align: ImageAlign | undefined = undefined,
  ) {
    super()
  }
  eq(other: ImageWidget): boolean {
    return (
      other.src === this.src &&
      other.alt === this.alt &&
      other.docPath === this.docPath &&
      other.width === this.width &&
      other.align === this.align &&
      other.from === this.from &&
      other.to === this.to
    )
  }
  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'ink-img-wrap'

    const img = document.createElement('img')
    img.className = 'ink-img'
    img.alt = this.alt
    img.title = this.alt || this.src
    img.loading = 'lazy'
    const resolved = resolveImageSrc(this.src, this.docPath)
    if (resolved) img.src = resolved
    if (this.width) img.style.width = this.width + 'px'
    if (this.align) {
      wrap.style.display = 'block'
      img.style.display = 'block'
      img.style.marginLeft = this.align === 'center' || this.align === 'right' ? 'auto' : '0'
      img.style.marginRight = this.align === 'center' || this.align === 'left' ? 'auto' : '0'
    }
    img.onerror = (): void => img.classList.add('ink-img-broken')
    // The image loads asynchronously and changes this widget's height; re-measure
    // so CM's height map (and click → caret mapping below it) stays accurate.
    img.onload = (): void => view.requestMeasure()
    wrap.appendChild(img)

    // Drag handle (bottom-right) to resize; writes width on release.
    const handle = document.createElement('span')
    handle.className = 'ink-img-handle'
    handle.title = translate('Drag to resize')
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = img.getBoundingClientRect().width
      handle.setPointerCapture(e.pointerId)
      const onMove = (ev: PointerEvent): void => {
        img.style.width = Math.max(16, startW + (ev.clientX - startX)) + 'px'
      }
      const onUp = (ev: PointerEvent): void => {
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
        writeImageWidth(view, this.from, this.to, startW + (ev.clientX - startX))
      }
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
    })
    wrap.appendChild(handle)

    // Alignment toolbar (top-left, on hover): left / center / right.
    const bar = document.createElement('span')
    bar.className = 'ink-img-align'
    const ALIGNS: { a: ImageAlign; glyph: string; title: string }[] = [
      { a: 'left', glyph: '⇤', title: 'Align left' },
      { a: 'center', glyph: '↔', title: 'Align center' },
      { a: 'right', glyph: '⇥', title: 'Align right' },
    ]
    for (const { a, glyph, title } of ALIGNS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'ink-img-align-btn' + (this.align === a ? ' is-active' : '')
      btn.textContent = glyph
      btn.title = translate(title)
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        writeImageAlign(view, this.from, this.to, a)
      })
      bar.appendChild(btn)
    }
    wrap.appendChild(bar)

    return wrap
  }
  ignoreEvent(): boolean {
    // Let clicks through so the caret can land on the line and reveal the source.
    return false
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

/** Renders a TeX expression with KaTeX (inline or display block). */
export class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly block: boolean,
  ) {
    super()
  }
  eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.block === this.block
  }
  toDOM(): HTMLElement {
    const el = document.createElement(this.block ? 'div' : 'span')
    el.className = this.block ? 'ink-math ink-math-block' : 'ink-math'
    try {
      katex.render(this.tex, el, { throwOnError: false, displayMode: this.block })
      // KaTeX centers display math via `.katex-display > .katex`; left-align it to
      // match the other block widgets. An inline style on that element beats
      // KaTeX's (non-important) stylesheet rule, and avoids a CSS rule targeting
      // the runtime-only `.katex*` classes (which Tailwind tree-shakes).
      if (this.block) {
        const disp = el.querySelector<HTMLElement>('.katex-display')
        if (disp) {
          disp.style.textAlign = 'left'
          const k = disp.querySelector<HTMLElement>('.katex')
          if (k) k.style.textAlign = 'left'
        }
      }
    } catch {
      el.textContent = this.tex
      el.classList.add('ink-math-error')
    }
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

// Lucide icon node type, derived so we don't depend on a named type export.
type LucideIcon = Parameters<typeof createIcon>[0]

// Toolbar layout: [icon, tooltip, action] groups separated by 'sep' dividers.
const TABLE_TOOLBAR_ITEMS: ([LucideIcon, string, TableAction] | 'sep')[] = [
  [ArrowUpToLine, 'Row above', 'rowAbove'],
  [ArrowDownToLine, 'Row below', 'rowBelow'],
  [Trash2, 'Delete row', 'deleteRow'],
  'sep',
  [ArrowLeftToLine, 'Column before', 'colBefore'],
  [ArrowRightToLine, 'Column after', 'colAfter'],
  [Trash, 'Delete column', 'deleteCol'],
  'sep',
  [AlignLeft, 'Align left', 'alignLeft'],
  [AlignCenter, 'Align center', 'alignCenter'],
  [AlignRight, 'Align right', 'alignRight'],
]

/**
 * Build the table toolbar (icon buttons + group dividers). `onAction` runs on
 * button activation; `preventDefault` keeps the caret put (so the rendered table
 * stays idle, and an actively-edited table keeps its caret inside it).
 */
function buildTableToolbar(onAction: (action: TableAction) => void): HTMLElement {
  const toolbar = document.createElement('div')
  toolbar.className = 'ink-table-toolbar'
  for (const item of TABLE_TOOLBAR_ITEMS) {
    if (item === 'sep') {
      const sep = document.createElement('span')
      sep.className = 'ink-tbl-sep'
      toolbar.appendChild(sep)
      continue
    }
    const [icon, title, action] = item
    const btn = document.createElement('button')
    btn.className = 'ink-tbl-btn'
    btn.title = translate(title)
    btn.setAttribute('aria-label', translate(title))
    btn.appendChild(createIcon(icon))
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    btn.addEventListener('click', () => onAction(action))
    toolbar.appendChild(btn)
  }
  return toolbar
}

/**
 * A pinned table toolbar shown ABOVE a table while the caret is editing it (the
 * table is raw markdown then, so the rendered table's hover toolbar is gone).
 * Buttons act on the cell at the caret via the caret-based `applyTable`.
 */
export class TableEditToolbarWidget extends WidgetType {
  eq(): boolean {
    return true
  }
  toDOM(view: EditorView): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'ink-table-abar'
    bar.appendChild(buildTableToolbar((action) => applyTable(view, action)))
    return bar
  }
}

const tableMarkdown = new MarkdownIt({ html: false, linkify: true })

// Cells wrap only at explicit word boundaries. Escape the token first so
// break opportunities are added to visible text, never to a link's href.
function renderTableText(text: string): string {
  return tableMarkdown.utils.escapeHtml(text).replace(/[ \t]+/g, '<wbr>$&')
}
tableMarkdown.renderer.rules.text = (tokens, i) => renderTableText(tokens[i].content)
tableMarkdown.renderer.rules.code_inline = (tokens, i) => '<code>' + renderTableText(tokens[i].content) + '</code>'

// Recognize empty anchors and explicit line breaks without enabling arbitrary HTML.
const emptyAnchor = /<a[ \t]+(?:id|name)[ \t]*=[ \t]*(?:"([^"\s<>]+)"|'([^'\s<>]+)')[ \t]*>[ \t]*<\/a[ \t]*>/iy
const tableLineBreak = /<br[ \t]*\/?>/iy
tableMarkdown.inline.ruler.before('html_inline', 'table_html', (state, silent) => {
  if (state.src[state.pos] !== '<') return false
  tableLineBreak.lastIndex = state.pos
  if (tableLineBreak.test(state.src) && tableLineBreak.lastIndex <= state.posMax) {
    if (!silent) state.push('hardbreak', 'br', 0)
    state.pos = tableLineBreak.lastIndex
    return true
  }
  emptyAnchor.lastIndex = state.pos
  if (!emptyAnchor.test(state.src) || emptyAnchor.lastIndex > state.posMax) return false
  state.pos = emptyAnchor.lastIndex
  return true
})

function renderCell(cell: HTMLTableCellElement, text: string): void {
  cell.innerHTML = DOMPurify.sanitize(tableMarkdown.renderInline(text), {
    ALLOWED_TAGS: ['strong', 'em', 's', 'code', 'a', 'br', 'wbr'],
    ALLOWED_ATTR: ['href', 'title']
  })
}

interface ActiveCell {
  row: number
  col: number
  table: TableWidget
  editor: EditorView
}

const activeCells = new WeakMap<HTMLElement, ActiveCell>()
const renderedTables = new WeakMap<HTMLElement, TableWidget>()
const cellMarkdown = markdown({
  base: markdownLanguage,
  extensions: [
    Subscript,
    Superscript,
    {
      remove: [
        'ATXHeading',
        'SetextHeading',
        'HorizontalRule',
        'Blockquote',
        'BulletList',
        'OrderedList',
        'HTMLBlock',
        'FencedCode',
        'IndentedCode',
        'LinkReference',
        'Table'
      ]
    }
  ]
})

/**
 * Renders a GFM table as a styled HTML <table> on idle lines, with an inline
 * toolbar (add/delete row+col, alignment) and draggable column borders. Controls
 * mutate the **markdown source** through `tableCommands` — the source stays the
 * single source of truth. `pos` is a document offset inside the table so the
 * controls can locate it even though the caret isn't in the table (it's idle).
 */
export class TableWidget extends WidgetType {
  constructor(
    readonly md: string,
    readonly pos: number,
    readonly visualCells = false
  ) {
    super()
  }
  eq(other: TableWidget): boolean {
    return other.md === this.md && other.pos === this.pos && other.visualCells === this.visualCells
  }
  updateDOM(wrap: HTMLElement, _view: EditorView, previous: TableWidget): boolean {
    const cell = activeCells.get(wrap)
    if (!this.visualCells || !cell) return false
    const change = tableCellChange(
      previous.md,
      cell.row,
      cell.col,
      cell.editor.state.doc.toString()
    )
    if (
      previous.md !== this.md &&
      (!change ||
        previous.md.slice(0, change.from) + change.insert + previous.md.slice(change.to) !==
          this.md)
    )
      return false
    cell.table = this
    renderedTables.set(wrap, this)
    return true
  }
  destroy(wrap: HTMLElement): void {
    activeCells.get(wrap)?.editor.destroy()
    activeCells.delete(wrap)
  }

  private bindCell(
    wrap: HTMLElement,
    view: EditorView,
    cell: HTMLTableCellElement,
    row: number,
    col: number
  ) {
    if (!this.visualCells) return
    const content = document.createElement('div')
    content.className = 'ink-visual-cell'
    content.tabIndex = 0
    content.setAttribute('aria-label', translate('Edit table cell'))
    content.append(...cell.childNodes)
    cell.append(content)
    const start = (pointer?: MouseEvent) => {
      if (content.querySelector('.cm-editor')) return
      const table = renderedTables.get(wrap) ?? this
      const model = parseTable(table.md)
      const text = (row === -1 ? model?.header[col] : model?.rows[row]?.[col]) ?? ''
      // A focused cell runs the same Markdown renderer in a single-line editor.
      // Its changes are written straight back to the parent document.
      const mount = document.createElement('div')
      content.replaceChildren(mount)
      const editor = new EditorView({
        parent: mount,
        state: EditorState.create({
          doc: text,
          extensions: [
            cellMarkdown,
            livePreview,
            visualEditing,
            openLinksOnClick,
            floatingToolbar,
            EditorView.lineWrapping,
            drawSelection(),
            keymap.of(standardKeymap),
            cellMode.of(true),
            parentEditor.of(view),
            previewContext.of(view.state.facet(previewContext)),
            EditorView.contentAttributes.of({ 'aria-label': translate('Edit table cell') }),
            EditorView.clipboardInputFilter.of((value) => value.replace(/\r\n?|\n/g, '<br>')),
            EditorState.changeFilter.of((tr) => tr.newDoc.lines === 1),
            EditorView.updateListener.of((update) => {
              const active = activeCells.get(wrap)
              if (!update.docChanged || active?.editor !== update.view) return
              const { md, pos } = active.table
              if (view.state.doc.sliceString(pos, pos + md.length) !== md) return
              const change = tableCellChange(md, row, col, update.state.doc.toString())
              if (change)
                view.dispatch({
                  changes: { from: pos + change.from, to: pos + change.to, insert: change.insert }
                })
            })
          ]
        })
      })
      const active = { row, col, table, editor }
      activeCells.set(wrap, active)
      const finish = () => {
        if (activeCells.get(wrap) !== active) return
        const display = document.createElement('td')
        const model = parseTable(active.table.md)
        renderCell(display, (row === -1 ? model?.header[col] : model?.rows[row]?.[col]) ?? '')
        activeCells.delete(wrap)
        editor.destroy()
        content.replaceChildren(...display.childNodes)
      }
      mount.addEventListener('focusout', (event) => {
        if (!(event.relatedTarget instanceof Node) || !content.contains(event.relatedTarget))
          finish()
      })
      mount.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' && event.key !== 'Enter') return
        if (event.isComposing) return
        event.preventDefault()
        event.stopPropagation()
        content.focus()
      })
      const position = pointer
        ? editor.posAtCoords({ x: pointer.clientX, y: pointer.clientY }, false)
        : null
      editor.dispatch({ selection: { anchor: position ?? editor.state.doc.length } })
      editor.focus()
    }
    content.addEventListener('click', (event) => {
      if (!event.ctrlKey && !event.metaKey) start(event)
    })
    content.addEventListener('keydown', (event) => {
      if (event.target === content && (event.key === 'Enter' || event.key === 'F2')) {
        event.preventDefault()
        start()
      }
    })
  }
  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'ink-table-wrap'
    if (this.visualCells) renderedTables.set(wrap, this)
    const model = parseTable(this.md)
    if (!model) {
      wrap.textContent = this.md
      return wrap
    }
    const pos = this.pos

    // Current toolbar target, set as the mouse moves over cells.
    let activeRow = -1 // -1 = header row
    let activeCol = 0

    const table = document.createElement('table')
    table.className = 'ink-table'
    table.addEventListener('mousedown', (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.target instanceof Element &&
        event.target.closest('a[href]')
      ) {
        // Keep CodeMirror from replacing the clicked widget with raw Markdown before click.
        event.preventDefault()
        event.stopPropagation()
      }
    })
    table.addEventListener('click', (event) => {
      const link = event.target instanceof Element ? event.target.closest('a') : null
      if (!link) return
      event.preventDefault()
      const href = link.getAttribute('href') ?? ''
      if (event.ctrlKey || event.metaKey) followLink(view, href)
    })
    const ncols = model.header.length
    const colEls: HTMLTableColElement[] = []
    const colgroup = document.createElement('colgroup')
    for (let i = 0; i < ncols; i++) {
      const col = document.createElement('col')
      colgroup.appendChild(col)
      colEls.push(col)
    }
    table.appendChild(colgroup)

    // Mark a cell as the toolbar target on hover (header row = activeRow -1).
    const target = (r: number, c: number) => (): void => {
      activeRow = r
      activeCol = c
    }

    const thead = document.createElement('thead')
    const htr = document.createElement('tr')
    model.header.forEach((cell, i) => {
      const th = document.createElement('th')
      renderCell(th, cell)
      const align = model.aligns[i]
      if (align !== undefined && align !== 'none') th.style.textAlign = align
      th.addEventListener('mouseenter', target(-1, i))
      this.bindCell(wrap, view, th, -1, i)
      // A draggable border on the right edge resizes this column (visual only —
      // GFM has no column widths, so it resets on the next edit).
      if (i < ncols) th.appendChild(this.resizeHandle(colEls, i, table))
      htr.appendChild(th)
    })
    thead.appendChild(htr)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    model.rows.forEach((row, r) => {
      const tr = document.createElement('tr')
      row.forEach((cell, i) => {
        const td = document.createElement('td')
        renderCell(td, cell)
        const align = model.aligns[i]
        if (align !== undefined && align !== 'none') td.style.textAlign = align
        td.addEventListener('mouseenter', target(r, i))
        this.bindCell(wrap, view, td, r, i)
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)

    // Inline toolbar (shown on hover via CSS); each button edits the source at
    // the hovered target cell. mousedown + preventDefault keeps the caret out of
    // the table so it stays rendered (idle) through the edit.
    const toolbar = buildTableToolbar((action) =>
      applyTableAt(view, renderedTables.get(wrap)?.pos ?? pos, activeRow, activeCol, action)
    )

    wrap.appendChild(toolbar)
    wrap.appendChild(table)
    return wrap
  }

  /** A drag handle on a column's right border; sets the `<col>` width visually. */
  private resizeHandle(
    colEls: HTMLTableColElement[],
    i: number,
    table: HTMLTableElement
  ): HTMLElement {
    const handle = document.createElement('span')
    handle.className = 'ink-col-resize'
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      // Freeze current widths so the dragged column doesn't reflow the others.
      const ths = table.querySelectorAll('thead th')
      ths.forEach((th, j) => {
        const colEl = colEls[j]
        if (colEl) colEl.style.width = (th as HTMLElement).getBoundingClientRect().width + 'px'
      })
      table.style.tableLayout = 'fixed'
      const startX = e.clientX
      const startTh = ths[i]
      const startW = startTh ? (startTh as HTMLElement).getBoundingClientRect().width : 0
      const onMove = (ev: MouseEvent): void => {
        const colEl = colEls[i]
        if (colEl) colEl.style.width = Math.max(40, startW + (ev.clientX - startX)) + 'px'
      }
      const onUp = (): void => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
    return handle
  }

  ignoreEvent(event: Event): boolean {
    return (
      this.visualCells &&
      event.target instanceof Element &&
      !!event.target.closest('.ink-visual-cell')
    )
  }
}

/** Renders a sanitized HTML block on idle lines (passthrough, XSS-safe). */
export class HtmlBlockWidget extends WidgetType {
  constructor(
    readonly html: string,
  ) {
    super()
  }
  eq(other: HtmlBlockWidget): boolean {
    return other.html === this.html
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'ink-html'
    // Sanitize to prevent script/onerror injection from an untrusted document.
    el.innerHTML = DOMPurify.sanitize(this.html, {
      ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub',
        'mark', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'details', 'summary', 'table',
        'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'],
      ALLOWED_ATTR: ['colspan', 'rowspan', 'open']
    })
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Auto-generated table of contents rendered in place of a `[toc]` line. */
export class TocWidget extends WidgetType {
  constructor(readonly headings: { level: number; text: string; from: number }[]) {
    super()
  }
  eq(other: TocWidget): boolean {
    if (other.headings.length !== this.headings.length) return false
    return this.headings.every((h, i) => {
      const oh = other.headings[i]
      return oh !== undefined && h.text === oh.text && h.level === oh.level && h.from === oh.from
    })
  }
  toDOM(view: EditorView): HTMLElement {
    const nav = document.createElement('div')
    nav.className = 'ink-toc'
    const title = document.createElement('div')
    title.className = 'ink-toc-title'
    title.textContent = translate('Table of Contents')
    nav.appendChild(title)
    for (const h of this.headings) {
      const a = document.createElement('a')
      a.className = 'ink-toc-item ink-toc-l' + h.level
      a.textContent = h.text
      a.onmousedown = (e): void => e.preventDefault()
      a.onclick = (e): void => {
        e.preventDefault()
        view.dispatch({
          selection: { anchor: h.from },
          effects: EditorView.scrollIntoView(h.from, { y: 'start' }),
        })
        view.focus()
      }
      nav.appendChild(a)
    }
    return nav
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Footnote reference `[^id]` rendered as a superscript with the text as tooltip. */
export class FootnoteRefWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly text: string,
  ) {
    super()
  }
  eq(other: FootnoteRefWidget): boolean {
    return other.id === this.id && other.text === this.text
  }
  toDOM(): HTMLElement {
    const sup = document.createElement('sup')
    sup.className = 'ink-footnote'
    sup.textContent = this.id
    if (this.text) sup.title = this.text
    return sup
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Label shown in place of `[!NOTE]` etc. at the top of a GitHub alert. */
export class AlertLabelWidget extends WidgetType {
  constructor(readonly type: string) {
    super()
  }
  eq(other: AlertLabelWidget): boolean {
    return other.type === this.type
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'ink-alert-label'
    span.textContent = translate(this.type.charAt(0).toUpperCase() + this.type.slice(1))
    return span
  }
}

/** Renders a ```mermaid block as an SVG diagram (async) on idle lines. */
export class MermaidWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly dark: boolean,
  ) {
    super()
  }
  eq(other: MermaidWidget): boolean {
    return other.code === this.code && other.dark === this.dark
  }
  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('div')
    el.className = 'ink-mermaid'
    el.textContent = translate('Rendering diagram…')
    void renderMermaid(this.code, this.dark).then(({ svg, error }) => {
      if (error) {
        el.classList.add('ink-mermaid-error')
        el.textContent = error
      } else if (svg) {
        el.innerHTML = svg
      }
      // The diagram renders asynchronously and changes this widget's height, so
      // ask CM to re-measure — otherwise its height map (and the click → caret
      // mapping for everything below) stays stale and clicks land a line off.
      view.requestMeasure()
    })
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Language badge + copy button shown at the top-right of a code fence. */
export class CodeBadgeWidget extends WidgetType {
  constructor(
    readonly lang: string,
    readonly code: string,
  ) {
    super()
  }
  eq(other: CodeBadgeWidget): boolean {
    return other.lang === this.lang && other.code === this.code
  }
  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'ink-code-badge'
    wrap.contentEditable = 'false'

    if (this.lang) {
      const label = document.createElement('span')
      label.className = 'ink-code-lang'
      label.textContent = this.lang
      wrap.appendChild(label)
    }

    const btn = document.createElement('button')
    btn.className = 'ink-code-copy'
    btn.textContent = translate('Copy')
    btn.title = translate('Copy code')
    btn.onmousedown = (e): void => e.preventDefault()
    btn.onclick = (e): void => {
      e.preventDefault()
      e.stopPropagation()
      void navigator.clipboard.writeText(this.code).then(() => {
        btn.textContent = translate('Copied')
        setTimeout(() => (btn.textContent = translate('Copy')), 1200)
      })
    }
    wrap.appendChild(btn)
    return wrap
  }
  ignoreEvent(): boolean {
    return false
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
export function activeLines(state: EditorState): Set<number> {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    const a = state.doc.lineAt(range.from).number
    const b = state.doc.lineAt(range.to).number
    for (let n = a; n <= b; n++) lines.add(n)
  }
  return lines
}

// ---- Link helpers (ctrl/cmd-click navigation) ----

/** GitHub-style heading slug. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

// The live editor parses incrementally. A link near the top can target a
// table far beyond the parsed viewport in a long document.
const completeTrees = new WeakMap<Text, Tree>()

export function anchorOffset(state: EditorState, fragment: string): number | null {
  let slug: string
  try {
    slug = decodeURIComponent(fragment)
  } catch {
    slug = fragment
  }
  if (!slug) return null
  const text = state.doc.toString()
  for (const match of text.matchAll(new RegExp(emptyAnchor.source, 'gi'))) {
    if ((match[1] ?? match[2]) !== slug) continue
    let tree = syntaxTree(state)
    if (!syntaxTreeAvailable(state, match.index + match[0].length)) {
      tree = completeTrees.get(state.doc) ?? markdownLanguage.parser.parse(text)
      completeTrees.set(state.doc, tree)
    }
    // Literal examples inside code, escaped tags and comments are not destinations.
    const node = tree.resolve(match.index, 1)
    if (node.name === 'HTMLTag' && node.from === match.index) return match.index
  }
  const target = slug.toLowerCase()
  const h = parseOutline(text).find(
    (x) => x.id?.toLowerCase() === target || slugify(x.text) === target,
  )
  return h ? h.from : null
}

function followLink(view: EditorView, url: string): void {
  if (url.startsWith('#')) {
    const target = anchorOffset(view.state, url.slice(1))
    if (target != null) revealInEditor(view, target)
  } else if (/^(https?:\/\/|mailto:)/i.test(url)) {
    void openUrl(url)
  }
}

/** Resolve a reference-link id against its `[id]: url` definition. */
function resolveReference(docText: string, id: string): string | null {
  if (!id) return null
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = docText.match(new RegExp('^ {0,3}\\[' + esc + '\\]:\\s*<?([^\\s>]+)', 'mi'))
  return m?.[1] ?? null
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
  const lastLabel = labels.at(-1)
  let id = lastLabel ? doc.sliceString(lastLabel.from, lastLabel.to) : ''
  id = id.replace(/^\[|\]$/g, '').trim()
  if (!id)
    id = doc
      .sliceString(node.from, node.to)
      .replace(/^\[|\][\s\S]*$/g, '')
      .trim()
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
    followLink(view.state.facet(parentEditor) ?? view, url)
    return true
  },
})

// ---- Emoji (:shortcode: rendering + autocomplete) ----

const EMOJI_RE = /:([a-z0-9_+-]+):/g

/** Replace `:shortcode:` with the emoji glyph on idle lines. */
function emojiDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  out: Range<Decoration>[],
): void {
  EMOJI_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = EMOJI_RE.exec(text)) !== null) {
    const shortcode = m[1]
    if (shortcode === undefined) continue
    const char = emojiGet(shortcode)
    if (!char || char.includes(':')) continue
    const start = base + m.index
    if (active.has(doc.lineAt(start).number)) continue
    out.push(
      Decoration.replace({ widget: new EmojiWidget(char) }).range(start, start + m[0].length),
    )
  }
}

// Custom heading IDs: `### Title {#id}` — hide the trailing `{#id}` on idle lines.
const HEADING_ID_RE = /^(#{1,6}\s.*?)\s*\{#[A-Za-z0-9_-]+\}\s*$/

/** Hide the `{#id}` suffix of a heading on idle lines (editable when active). */
function headingIdDecos(doc: Text, active: Set<number>, out: Range<Decoration>[]): void {
  for (let n = 1; n <= doc.lines; n++) {
    if (active.has(n)) continue
    const line = doc.line(n)
    if (line.text.charCodeAt(0) !== 35) continue // 35 = '#', skip non-headings fast
    const m = HEADING_ID_RE.exec(line.text)
    const prefix = m?.[1]
    if (prefix !== undefined)
      out.push(Decoration.replace({}).range(line.from + prefix.length, line.to))
  }
}

// Definition lists: a term line followed by `: definition` lines (Markdown Extra).
const DEF_LINE_RE = /^:[ \t]+\S/

/** Style definition lists on idle lines: bold the term, indent the definition,
 *  and hide the leading `: ` marker. */
function defListDecos(doc: Text, active: Set<number>, out: Range<Decoration>[]): void {
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (line.text.charCodeAt(0) !== 58 /* ':' */ || !DEF_LINE_RE.test(line.text)) continue
    const prev = n > 1 ? doc.line(n - 1) : null
    const firstOfGroup = !prev || !(prev.text.charCodeAt(0) === 58 && DEF_LINE_RE.test(prev.text))
    if (firstOfGroup && prev && prev.text.trim() !== '' && !active.has(n - 1)) {
      out.push(Decoration.line({ class: 'ink-dt' }).range(prev.from))
    }
    if (!active.has(n)) {
      out.push(Decoration.line({ class: 'ink-dd' }).range(line.from))
      const mk = /^:[ \t]+/.exec(line.text)![0]
      out.push(Decoration.replace({}).range(line.from, line.from + mk.length))
    }
  }
}

// LaTeX math: block `$$…$$` (may span lines) is matched before inline `$…$`.
const MATH_BLOCK_RE = /\$\$([\s\S]+?)\$\$/g
const MATH_INLINE_RE = /(?<![\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)/g

/** True if any line spanned by [start,end] is active (so we show raw source). */
function rangeActive(start: number, end: number, active: Set<number>, doc: Text): boolean {
  const a = doc.lineAt(start).number
  const b = doc.lineAt(end).number
  for (let n = a; n <= b; n++) if (active.has(n)) return true
  return false
}

/** Render `$$…$$` (display) and `$…$` (inline) math with KaTeX on idle lines. */
function mathDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  out: Range<Decoration>[],
): void {
  // Track block spans so inline pass can skip the `$` inside them.
  const blocked: [number, number][] = []
  MATH_BLOCK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MATH_BLOCK_RE.exec(text)) !== null) {
    const rawTex = m[1]
    if (rawTex === undefined) continue
    const tex = rawTex.trim()
    // Two stray `$$` (e.g. prices "$$", shell vars) must NOT be treated as one
    // math block — that would hide everything between them. Real display math
    // never contains a blank line, so a blank line means these aren't a pair.
    if (!tex || /\n[ \t]*\n/.test(rawTex)) continue
    const start = base + m.index
    const end = start + m[0].length
    blocked.push([m.index, m.index + m[0].length])
    if (rangeActive(start, end, active, doc)) continue
    out.push(Decoration.replace({ widget: new MathWidget(tex, true) }).range(start, end))
  }

  MATH_INLINE_RE.lastIndex = 0
  while ((m = MATH_INLINE_RE.exec(text)) !== null) {
    const idx = m.index
    if (blocked.some(([s, e]) => idx >= s && idx < e)) continue
    const start = base + idx
    const end = start + m[0].length
    if (rangeActive(start, end, active, doc)) continue
    const rawTex = m[1]
    if (rawTex === undefined) continue
    const tex = rawTex.trim()
    if (!tex) continue
    out.push(Decoration.replace({ widget: new MathWidget(tex, false) }).range(start, end))
  }
}

/** Render a line that is exactly `[toc]` as a generated table of contents. */
function tocDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  headings: { level: number; text: string; from: number }[],
  out: Range<Decoration>[],
): void {
  const re = /^[ \t]*\[toc\][ \t]*$/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const start = base + m.index
    const line = doc.lineAt(start)
    if (active.has(line.number)) continue
    out.push(
      Decoration.replace({ widget: new TocWidget(headings), block: false }).range(
        line.from,
        line.to,
      ),
    )
  }
}

// Footnotes: reference `[^id]` and definition `[^id]: text` (whole-doc lookup).
const FOOTNOTE_REF_RE = /\[\^([^\]\s]+)\]/g

/** Map of footnote id -> definition text, parsed from the whole document. */
function footnoteDefs(fullText: string): Map<string, string> {
  const defs = new Map<string, string>()
  const re = /^\s*\[\^([^\]\s]+)\]:\s*(.+)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(fullText)) !== null) {
    const id = m[1]
    const body = m[2]
    if (id !== undefined && body !== undefined) defs.set(id, body.trim())
  }
  return defs
}

/** Render footnote references `[^id]` as superscripts with the def as tooltip. */
function footnoteDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  defs: Map<string, string>,
  out: Range<Decoration>[],
): void {
  FOOTNOTE_REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FOOTNOTE_REF_RE.exec(text)) !== null) {
    const id = m[1]
    if (id === undefined) continue
    const start = base + m.index
    const end = start + m[0].length
    const line = doc.lineAt(start)
    // Skip definition lines (`[^id]:` at line start) and active lines.
    if (/^\s*\[\^[^\]\s]+\]:/.test(line.text)) continue
    if (active.has(line.number)) continue
    out.push(
      Decoration.replace({ widget: new FootnoteRefWidget(id, defs.get(id) ?? '') }).range(
        start,
        end,
      ),
    )
  }
}

/** Autocomplete `:shortcode` -> emoji (inserts the glyph). Gated by the emoji
 *  feature flag, like the `:shortcode:` rendering (the emoji picker, which
 *  inserts a literal glyph, stays available regardless). */
export const emojiCompletion: CompletionSource = (ctx) => {
  if (ctx.state.facet(previewContext).features?.emoji === false) return null
  const token = ctx.matchBefore(/:[a-z0-9_+-]*/)
  if (!token || (token.from === token.to && !ctx.explicit)) return null
  const query = token.text.slice(1)
  if (!query) return null
  const matches = emojiSearch(query).slice(0, 12)
  if (!matches.length) return null
  return {
    from: token.from,
    options: matches.map((r) => ({ label: ':' + r.name + ':', detail: r.emoji, apply: r.emoji })),
  }
}

// Standalone HTML <img …> tags (Lezer leaves these as raw HTML); rendered like
// markdown images so resize/HTML-syntax round-trips work.
const HTML_IMG_RE = /<img\b[^>]*>/gi

/** Decorate standalone `<img>` tags as image widgets on idle lines. */
function htmlImageDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  docPath: string | null,
  out: Range<Decoration>[],
): void {
  HTML_IMG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HTML_IMG_RE.exec(text)) !== null) {
    const start = base + m.index
    const end = start + m[0].length
    const line = doc.lineAt(start)
    if (active.has(line.number)) continue
    const parsed = parseHtmlImage(m[0])
    if (!parsed) continue
    if (start === line.from && end === line.to) {
      out.push(Decoration.line({ class: 'ink-img-line' }).range(line.from))
    }
    out.push(
      Decoration.replace({
        widget: new ImageWidget(
          parsed.src,
          parsed.alt,
          docPath,
          parsed.width,
          start,
          end,
          parsed.align,
        ),
      }).range(start, end),
    )
  }
}

// Inline syntaxes Lezer doesn't parse: <u>underline</u>, ==highlight==, <!--comments-->.
const INLINE_RULES: { re: RegExp; cls: string | null; open: number; close: number }[] = [
  { re: /<u>([\s\S]+?)<\/u>/gi, cls: 'ink-u', open: 3, close: 4 },
  { re: /==([^=\n]+)==/g, cls: 'ink-highlight', open: 2, close: 2 },
  { re: /<!--[\s\S]*?-->/g, cls: null, open: 4, close: 3 }, // comment: hide entirely
]

/** Decorate regex-only inline syntaxes (underline / highlight / comment). */
function inlineRegexDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  out: Range<Decoration>[],
  highlight: boolean,
): void {
  for (const { re, cls, open, close } of INLINE_RULES) {
    if (!highlight && cls === 'ink-highlight') continue
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const start = base + m.index
      const end = start + m[0].length
      const lineActive = rangeActive(start, end, active, doc)
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
/** Link-reference comment lines: `[…]: #` (conventional hidden text) + our
 *  `[//]: # (payload)` carrier. Real reference defs keep a non-`#` destination. */
const COMMENT_LINE_RE = /^[ \t]*\[[^\]\n]*\]:[ \t]*#/

/** Hide hidden-comment lines on idle lines — the whole line + its break is replaced
 *  so no empty row or frame remains. The caret line stays raw so it can be edited. */
function commentLineDecos(doc: Text, active: Set<number>, out: Range<Decoration>[]): void {
  for (let n = 1; n <= doc.lines; n++) {
    if (active.has(n)) continue
    const line = doc.line(n)
    if (!COMMENT_LINE_RE.test(line.text)) continue
    const to = n < doc.lines ? doc.line(n + 1).from : line.to
    out.push(Decoration.replace({}).range(line.from, to))
  }
}

export function buildDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
  active: Set<number>,
  docPath: string | null = null,
): DecorationSet {
  const decos: Range<Decoration>[] = []
  const doc = state.doc
  const fullText = doc.toString()
  const features = state.facet(previewContext).features ?? DEFAULT_MARKDOWN_FEATURES
  const visual = state.facet(keepMarkupHidden)
  const fnDefs = features.footnotes ? footnoteDefs(fullText) : new Map<string, string>()
  // Parse headings once for any `[toc]` widget (excludes the [toc] line itself).
  const tocHeadings = features.toc && /\[toc\]/i.test(fullText) ? parseOutline(fullText) : []

  // YAML front matter: a `---` fence on line 1 with a later closing `---`.
  // Styled as a metadata block; always visible (it stays editable).
  if (doc.lines >= 2 && doc.line(1).text.trim() === '---') {
    let closing = 0
    for (let ln = 2; ln <= doc.lines; ln++) {
      const t = doc.line(ln).text.trim()
      if (t === '---' || t === '...') {
        closing = ln
        break
      }
    }
    if (closing > 0) {
      for (let ln = 1; ln <= closing; ln++) {
        const cls =
          ln === 1
            ? 'ink-frontmatter ink-frontmatter-first'
            : ln === closing
              ? 'ink-frontmatter ink-frontmatter-last'
              : 'ink-frontmatter'
        decos.push(Decoration.line({ class: cls }).range(doc.line(ln).from))
      }
    }
  }

  const literalSpans: { from: number; to: number }[] = []
  const extras: Range<Decoration>[] = []
  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node): boolean | void => {
        const name = node.name
        if (name === 'HTMLTag') {
          const line = doc.lineAt(node.from)
          if (state.facet(cellMode) && /^<br[ \t]*\/?>$/i.test(doc.sliceString(node.from, node.to))) {
            decos.push(Decoration.replace({ widget: new CellBreakWidget() }).range(node.from, node.to))
            return
          }
          if (!active.has(line.number)) {
            emptyAnchor.lastIndex = node.from - line.from
            const anchor = emptyAnchor.exec(line.text)
            if (anchor) decos.push(Decoration.replace({}).range(node.from, node.from + anchor[0].length))
          }
          return
        }
        if (!features.subSup && (name === 'Subscript' || name === 'Superscript')) return false
        if (name === 'Link' || name === 'LinkReference') {
          const text = doc.sliceString(node.from, node.to)
          if ((!features.toc && /^\[toc\]$/i.test(text)) ||
              (!features.footnotes && text.startsWith('[^')) ||
              (!features.alerts && /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i.test(text))) return false
        }
        if (['InlineCode', 'FencedCode', 'CodeBlock', 'HTMLBlock', 'Table'].includes(name)) {
          literalSpans.push({ from: node.from, to: node.to })
        }

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

        // 3b) Image ![alt](src): render as <img> on idle lines. Return false to
        //     skip children (avoids overlapping decorations inside the widget);
        //     on the active line we leave the raw markdown fully visible.
        if (name === 'Image') {
          const line = doc.lineAt(node.from)
          if (!active.has(line.number)) {
            const text = doc.sliceString(node.from, node.to)
            const image = parseMarkdownImage(text)
            if (image) {
              const { alt, src } = image
              // Center a paragraph that is just an image (Typora behaviour).
              if (node.from === line.from && node.to === line.to) {
                decos.push(Decoration.line({ class: 'ink-img-line' }).range(line.from))
              }
              decos.push(
                Decoration.replace({
                  widget: new ImageWidget(src, alt, docPath, undefined, node.from, node.to),
                }).range(node.from, node.to),
              )
            }
          }
          return false
        }

        // 3ba) Table: render as an HTML table on idle blocks; raw when active.
        if (name === 'Table') {
          const first = doc.lineAt(node.from)
          const last = doc.lineAt(node.to)
          let blockActive = false
          for (let ln = first.number; ln <= last.number; ln++) {
            if (active.has(ln)) {
              blockActive = true
              break
            }
          }
          if (!blockActive) {
            const md = doc.sliceString(node.from, node.to)
            decos.push(
              Decoration.replace({ widget: new TableWidget(md, node.from, visual), block: true }).range(
                node.from,
                node.to,
              ),
            )
          } else {
            // Editing the table (raw source shown): pin a toolbar above it so the
            // table controls stay available, acting on the cell at the caret.
            decos.push(
              Decoration.widget({
                widget: new TableEditToolbarWidget(),
                block: true,
                side: -1,
              }).range(node.from),
            )
          }
          return false
        }

        // 3bb) HTML block: render sanitized HTML on idle lines; raw when active.
        if (name === 'HTMLBlock') {
          const first = doc.lineAt(node.from)
          const last = doc.lineAt(node.to)
          let blockActive = false
          for (let ln = first.number; ln <= last.number; ln++) {
            if (active.has(ln)) {
              blockActive = true
              break
            }
          }
          if (!blockActive) {
            const html = doc.sliceString(node.from, node.to)
            const image = parseHtmlImage(html)
            if (image) {
              decos.push(Decoration.replace({
                widget: new ImageWidget(image.src, image.alt, docPath, image.width, node.from, node.to, image.align)
              }).range(node.from, node.to))
              return false
            }
            // With embeds off, leave iframe/video/audio blocks raw (visible +
            // editable) rather than rendering them to an empty sanitized div.
            const isEmbed = /<(iframe|video|audio)\b/i.test(html)
            if (!isEmbed) {
              decos.push(
                Decoration.replace({
                  widget: new HtmlBlockWidget(html),
                  block: true,
                }).range(node.from, node.to),
              )
            }
          }
          return false
        }

        // 3c) Fenced code block: shade the block, badge the language, add a copy
        //     button. The source stays visible/editable (no replacement).
        if (name === 'FencedCode') {
          const first = doc.lineAt(node.from)
          const last = doc.lineAt(node.to)
          const infoNode = node.node.getChild('CodeInfo')
          const textNode = node.node.getChild('CodeText')
          const lang = infoNode ? doc.sliceString(infoNode.from, infoNode.to) : ''
          const code = textNode ? doc.sliceString(textNode.from, textNode.to) : ''

          // Block is "active" when the caret is on any of its lines (raw source).
          let blockActive = false
          for (let ln = first.number; ln <= last.number; ln++) {
            if (active.has(ln)) {
              blockActive = true
              break
            }
          }

          // Mermaid: render the diagram on idle blocks; raw source when active.
          if (lang === 'mermaid' && !features.mermaid) return false
          if (lang === 'mermaid' && !blockActive && code.trim()) {
            const dark = state.facet(previewContext).dark
            decos.push(Decoration.line({ class: 'ink-img-line' }).range(first.from))
            decos.push(
              Decoration.replace({ widget: new MermaidWidget(code, dark), block: true }).range(
                node.from,
                node.to,
              ),
            )
            return false
          }

          // Hide the ``` fence lines on idle blocks (Typora-style) so the panel
          // reads like rendered code; reveal them raw when the caret is inside.
          // Needs at least one code line between the fences.
          const hideFences = !blockActive && last.number >= first.number + 2 && node.node.getChildren('CodeMark').length === 2
          if (hideFences) {
            decos.push(Decoration.replace({}).range(first.from, doc.line(first.number + 1).from))
            decos.push(Decoration.replace({}).range(doc.line(last.number - 1).to, last.to))
          }
          // Hiding the opening fence merges its line into the first code line
          // (CM keys the merged block at `first`), so the panel still starts at
          // `first`; only the closing fence trims the last shaded line.
          const panelFirst = first.number
          const panelLast = hideFences ? last.number - 1 : last.number

          // Shade the visible panel lines, rounding the first/last.
          for (let ln = panelFirst; ln <= panelLast; ln++) {
            const line = doc.line(ln)
            const cls =
              panelFirst === panelLast
                ? 'ink-code-block ink-code-first ink-code-last'
                : ln === panelFirst
                  ? 'ink-code-block ink-code-first'
                  : ln === panelLast
                    ? 'ink-code-block ink-code-last'
                    : 'ink-code-block'
            decos.push(Decoration.line({ class: cls }).range(line.from))
          }
          // Language/copy badge at the top-right of the panel. With fences
          // hidden, the opening line's position sits inside a replace (which
          // would swallow the widget), so anchor on the first visible code line.
          const badgePos = hideFences ? doc.line(first.number + 1).from : doc.line(panelFirst).to
          decos.push(
            Decoration.widget({ widget: new CodeBadgeWidget(lang, code), side: 1 }).range(badgePos),
          )
          return false
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
            const glyph = BULLET_GLYPHS[(listDepth(node) - 1) % BULLET_GLYPHS.length] ?? '•'
            decos.push(
              Decoration.replace({ widget: new BulletWidget(glyph) }).range(node.from, node.to),
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
                node.to,
              ),
            )
          }
          return
        }

        // 4b) Blockquote: style every line of the quote (left bar, indent, muted
        //     text via .cm-blockquote). The `>` marker is hidden by MARK_NODES.
        //     A `> [!NOTE]` first line turns it into a GitHub-style alert.
        if (name === 'Blockquote') {
          const firstLine = doc.lineAt(node.from)
          const first = firstLine.number
          const last = doc.lineAt(node.to).number
          const alert = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(firstLine.text)
          const alertType = features.alerts && alert?.[1] ? alert[1].toLowerCase() : null

          for (let ln = first; ln <= last; ln++) {
            const cls = alertType
              ? `cm-blockquote ink-alert ink-alert-${alertType}`
              : 'cm-blockquote'
            decos.push(Decoration.line({ class: cls }).range(doc.line(ln).from))
          }

          if (alertType) {
            // Hide the `[!TYPE]` marker on idle lines, show a label badge;
            // raw on the active line for editing.
            const markStart = firstLine.text.indexOf('[')
            const from = firstLine.from + markStart
            const to = firstLine.from + firstLine.text.length
            if (active.has(first)) {
              decos.push(Decoration.mark({ class: 'ink-mark' }).range(from, to))
            } else {
              decos.push(
                Decoration.replace({ widget: new AlertLabelWidget(alertType) }).range(from, to),
              )
            }
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
        if (MARK_NODES.has(name) || (visual && name === 'LinkTitle')) {
          const lineNo = doc.lineAt(node.from).number
          if (active.has(lineNo)) {
            decos.push(Decoration.mark({ class: 'ink-mark' }).range(node.from, node.to))
          } else if (node.to > node.from) {
            const whitespace = visual && name === 'HeaderMark' && /^\s*$/.test(doc.sliceString(doc.lineAt(node.from).from, node.from))
              ? doc.sliceString(node.to, doc.lineAt(node.to).to).match(/^[ \t]+/)?.[0].length ?? 0 : 0
            decos.push(Decoration.replace({}).range(node.from, node.to + whitespace))
          }
        }
      },
    })
    const slice = doc.sliceString(from, to)
    inlineRegexDecos(slice, from, active, doc, extras, features.highlight)
    if (features.emoji) emojiDecos(slice, from, active, doc, extras)
    htmlImageDecos(slice, from, active, doc, docPath, extras)
    if (features.math) mathDecos(slice, from, active, doc, extras)
    if (features.footnotes) footnoteDecos(slice, from, active, doc, fnDefs, extras)
    if (features.toc) tocDecos(slice, from, active, doc, tocHeadings, extras)
    if (features.headingIds) headingIdDecos(doc, active, extras)
    if (features.defList) defListDecos(doc, active, extras)
  }
  // Whole-doc, once (not per visible range): hide hidden-comment lines.
  commentLineDecos(doc, active, extras)

  extras.sort((a, b) => a.from - b.from)
  let idx = 0
  for (const extra of extras) {
    while (idx < literalSpans.length && literalSpans[idx].to <= extra.from) idx++
    if (idx === literalSpans.length || (extra.to <= literalSpans[idx].from && extra.from < literalSpans[idx].from)) {
      decos.push(extra)
    }
  }

  // RangeSet must be sorted by position; `true` lets CodeMirror sort for us.
  return Decoration.set(decos, true)
}

/**
 * Live-preview decorations are provided as a `StateField`, NOT a `ViewPlugin`.
 * CodeMirror forbids block widgets and line-break-spanning replacements (our
 * tables, mermaid/HTML blocks and multi-line `$$` math) from view plugins — it
 * throws at render time, breaking the view. Fields are computed before layout,
 * so block decorations are allowed there. We decorate the whole document (no
 * `visibleRanges`) and rebuild on doc or selection changes.
 */
function computeDecorations(state: EditorState): DecorationSet {
  const { docPath } = state.facet(previewContext)
  return buildDecorations(
    state,
    [{ from: 0, to: state.doc.length }],
    state.facet(keepMarkupHidden) ? new Set() : activeLines(state),
    docPath,
  )
}

const keepMarkupHidden = Facet.define<boolean, boolean>({
  combine: (values) => values.some(Boolean)
})
const cellMode = Facet.define<boolean, boolean>({ combine: (values) => values.some(Boolean) })
const parentEditor = Facet.define<EditorView, EditorView | null>({
  combine: (values) => values[0] ?? null
})

class CellBreakWidget extends WidgetType {
  get lineBreaks() {
    return 1
  }
  toDOM(): HTMLElement {
    return document.createElement('br')
  }
}

function deleteAcrossMarkup(view: EditorView, forward: boolean): boolean {
  const { state } = view
  const { main, ranges } = state.selection
  if (!main.empty || ranges.length !== 1 || state.readOnly) return false
  const line = state.doc.lineAt(main.head)
  const markers = new Map<number, number>()
  state.field(livePreview).between(line.from, line.to, (from, to, decoration) => {
    if (
      decoration.point &&
      !decoration.spec.widget &&
      from < to &&
      from >= line.from &&
      to <= line.to
    ) {
      markers.set(forward ? from : to, forward ? to : from)
    }
  })
  let position = main.head
  while (markers.has(position)) position = markers.get(position)!
  if (position === main.head) return false
  // Skip markup at the edge of a formatted span. Delete a visible grapheme.
  const adjacent = line.from + findClusterBreak(line.text, position - line.from, forward)
  if (adjacent !== position) {
    const from = Math.min(position, adjacent)
    view.dispatch({
      changes: { from, to: Math.max(position, adjacent) },
      selection: { anchor: from },
      userEvent: forward ? 'delete.forward' : 'delete.backward',
      scrollIntoView: true
    })
  }
  return true
}

const visualAtomic = new WeakMap<DecorationSet, RangeSet<Decoration>>()
export const visualEditing = [
  keepMarkupHidden.of(true),
  Prec.high(
    keymap.of([
      { key: 'Backspace', run: (view) => deleteAcrossMarkup(view, false) },
      { key: 'Delete', run: (view) => deleteAcrossMarkup(view, true) }
    ])
  ),
  EditorView.atomicRanges.of((view) => {
    const decorations = view.state.field(livePreview)
    const cached = visualAtomic.get(decorations)
    if (cached) return cached
    const ranges: Range<Decoration>[] = []
    for (const cursor = decorations.iter(); cursor.value; cursor.next()) {
      if (cursor.value.point && cursor.to > cursor.from)
        ranges.push(cursor.value.range(cursor.from, cursor.to))
    }
    const atomic = RangeSet.of(ranges, true)
    visualAtomic.set(decorations, atomic)
    return atomic
  })
]

interface PreviewContext {
  features?: MarkdownFeatures
  docPath: string | null
  dark: boolean
}

export const previewContext = Facet.define<PreviewContext, PreviewContext>({
  combine: (values) => values[0] ?? { docPath: null, dark: false }
})

export const livePreview = StateField.define<DecorationSet>({
  create: (state) => computeDecorations(state),
  update(value, tr) {
    const visual = tr.state.facet(keepMarkupHidden)
    const refresh = tr.startState.facet(previewContext) !== tr.state.facet(previewContext) ||
      visual !== tr.startState.facet(keepMarkupHidden)
    if (!tr.docChanged && (!tr.selection || visual) && !refresh && syntaxTree(tr.startState) === syntaxTree(tr.state)) return value
    return computeDecorations(tr.state)
  },
  provide: (f) => EditorView.decorations.from(f),
})
