import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import { Range, StateField, type EditorState, type Text } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { parseOutline } from '@renderer/lib/outline'
import { get as emojiGet, search as emojiSearch } from 'node-emoji'
import type { CompletionSource } from '@codemirror/autocomplete'
import { useAppStore } from '@renderer/store/useAppStore'
import { parseHtmlImage, parseImage, toHtmlImage } from '@renderer/lib/imageInput'
import katex from 'katex'
import { renderMermaid } from '@renderer/lib/mermaidRender'
import DOMPurify from 'dompurify'
import { parseTable } from '@renderer/lib/tableModel'

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

/** Directory portion of a file path (handles both `/` and `\`). */
function dirOf(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : ''
}

/**
 * Resolve an image `src` to something the renderer can load. Remote/data/blob
 * URLs pass through; local paths (relative to the document's folder, or an
 * explicit `file:`) are served via the custom `inkfile://` scheme, because
 * Chromium blocks raw `file://` subresources on the http dev origin. Returns the
 * raw src when there is no document path to resolve against.
 */
export function resolveImageSrc(src: string, docPath: string | null): string {
  const s = src.trim()
  if (/^(https?|data|blob|inkfile):/i.test(s)) return s
  if (/^file:/i.test(s)) return s.replace(/^file:/i, 'inkfile:')
  if (!docPath) return s

  const combined = (dirOf(docPath) + '/' + s).replace(/\\/g, '/')
  const isWinDrive = /^[a-zA-Z]:/.test(combined)
  const unixAbs = combined.startsWith('/')

  const out: string[] = []
  for (const part of combined.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  const joined = encodeURI(out.join('/'))
  if (isWinDrive) return 'inkfile:///' + joined
  return 'inkfile://' + (unixAbs ? '/' : '') + joined
}

/** Fired when a rendered image is clicked, to open the zoom overlay. */
export const IMAGE_ZOOM_EVENT = 'ink:image-zoom'

/** Rewrite the image at [from,to] as an HTML <img> with the given width. */
function writeImageWidth(view: EditorView, from: number, to: number, width: number): void {
  const text = view.state.doc.sliceString(from, to)
  const img = parseImage(text)
  if (!img) return
  const next = toHtmlImage({ ...img, width: Math.max(16, Math.round(width)) })
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
    readonly to: number
  ) {
    super()
  }
  eq(other: ImageWidget): boolean {
    return (
      other.src === this.src &&
      other.alt === this.alt &&
      other.docPath === this.docPath &&
      other.width === this.width &&
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
    img.src = resolved
    if (this.width) img.style.width = this.width + 'px'
    img.onerror = (): void => img.classList.add('ink-img-broken')
    // Plain click zooms; modified clicks fall through to caret/link handling.
    img.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      window.dispatchEvent(
        new CustomEvent(IMAGE_ZOOM_EVENT, { detail: { src: resolved, alt: this.alt } })
      )
    })
    wrap.appendChild(img)

    // Drag handle (bottom-right) to resize; writes width on release.
    const handle = document.createElement('span')
    handle.className = 'ink-img-handle'
    handle.title = 'Drag to resize'
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
    readonly block: boolean
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

/** Renders a GFM table as a styled HTML <table> on idle lines. */
export class TableWidget extends WidgetType {
  constructor(readonly md: string) {
    super()
  }
  eq(other: TableWidget): boolean {
    return other.md === this.md
  }
  toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'ink-table-wrap'
    const model = parseTable(this.md)
    if (!model) {
      wrap.textContent = this.md
      return wrap
    }
    const table = document.createElement('table')
    table.className = 'ink-table'
    const thead = document.createElement('thead')
    const htr = document.createElement('tr')
    model.header.forEach((cell, i) => {
      const th = document.createElement('th')
      th.textContent = cell
      if (model.aligns[i] !== 'none') th.style.textAlign = model.aligns[i]
      htr.appendChild(th)
    })
    thead.appendChild(htr)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    model.rows.forEach((row) => {
      const tr = document.createElement('tr')
      row.forEach((cell, i) => {
        const td = document.createElement('td')
        td.textContent = cell
        if (model.aligns[i] !== 'none') td.style.textAlign = model.aligns[i]
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    wrap.appendChild(table)
    return wrap
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Renders a sanitized HTML block on idle lines (passthrough, XSS-safe). */
export class HtmlBlockWidget extends WidgetType {
  constructor(readonly html: string) {
    super()
  }
  eq(other: HtmlBlockWidget): boolean {
    return other.html === this.html
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'ink-html'
    // Sanitize to prevent script/onerror injection from an untrusted document.
    el.innerHTML = DOMPurify.sanitize(this.html)
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
    return this.headings.every(
      (h, i) => h.text === other.headings[i].text && h.level === other.headings[i].level
    )
  }
  toDOM(view: EditorView): HTMLElement {
    const nav = document.createElement('div')
    nav.className = 'ink-toc'
    const title = document.createElement('div')
    title.className = 'ink-toc-title'
    title.textContent = 'Table of Contents'
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
          effects: EditorView.scrollIntoView(h.from, { y: 'start' })
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
    readonly text: string
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
    span.textContent = this.type.charAt(0).toUpperCase() + this.type.slice(1)
    return span
  }
}

/** Renders a ```mermaid block as an SVG diagram (async) on idle lines. */
export class MermaidWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly dark: boolean
  ) {
    super()
  }
  eq(other: MermaidWidget): boolean {
    return other.code === this.code && other.dark === this.dark
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'ink-mermaid'
    el.textContent = 'Rendering diagram…'
    void renderMermaid(this.code, this.dark).then(({ svg, error }) => {
      if (error) {
        el.classList.add('ink-mermaid-error')
        el.textContent = error
      } else if (svg) {
        el.innerHTML = svg
      }
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
    readonly code: string
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
    btn.textContent = 'Copy'
    btn.title = 'Copy code'
    btn.onmousedown = (e): void => e.preventDefault()
    btn.onclick = (e): void => {
      e.preventDefault()
      e.stopPropagation()
      void navigator.clipboard.writeText(this.code).then(() => {
        btn.textContent = 'Copied'
        setTimeout(() => (btn.textContent = 'Copy'), 1200)
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
  out: Range<Decoration>[]
): void {
  // Track block spans so inline pass can skip the `$` inside them.
  const blocked: [number, number][] = []
  MATH_BLOCK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MATH_BLOCK_RE.exec(text)) !== null) {
    const tex = m[1].trim()
    // Two stray `$$` (e.g. prices "$$", shell vars) must NOT be treated as one
    // math block — that would hide everything between them. Real display math
    // never contains a blank line, so a blank line means these aren't a pair.
    if (!tex || /\n[ \t]*\n/.test(m[1])) continue
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
    const tex = m[1].trim()
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
  out: Range<Decoration>[]
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
        line.to
      )
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
  while ((m = re.exec(fullText)) !== null) defs.set(m[1], m[2].trim())
  return defs
}

/** Render footnote references `[^id]` as superscripts with the def as tooltip. */
function footnoteDecos(
  text: string,
  base: number,
  active: Set<number>,
  doc: Text,
  defs: Map<string, string>,
  out: Range<Decoration>[]
): void {
  FOOTNOTE_REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FOOTNOTE_REF_RE.exec(text)) !== null) {
    const start = base + m.index
    const end = start + m[0].length
    const line = doc.lineAt(start)
    // Skip definition lines (`[^id]:` at line start) and active lines.
    if (/^\s*\[\^[^\]\s]+\]:/.test(line.text)) continue
    if (active.has(line.number)) continue
    out.push(
      Decoration.replace({ widget: new FootnoteRefWidget(m[1], defs.get(m[1]) ?? '') }).range(
        start,
        end
      )
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
  out: Range<Decoration>[]
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
        widget: new ImageWidget(parsed.src, parsed.alt, docPath, parsed.width, start, end)
      }).range(start, end)
    )
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
  active: Set<number>,
  docPath: string | null = null
): DecorationSet {
  const decos: Range<Decoration>[] = []
  const doc = state.doc
  const fullText = doc.toString()
  const fnDefs = footnoteDefs(fullText)
  // Parse headings once for any `[toc]` widget (excludes the [toc] line itself).
  const tocHeadings = parseOutline(fullText)

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

  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node): boolean | void => {
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

        // 3b) Image ![alt](src): render as <img> on idle lines. Return false to
        //     skip children (avoids overlapping decorations inside the widget);
        //     on the active line we leave the raw markdown fully visible.
        if (name === 'Image') {
          const line = doc.lineAt(node.from)
          if (!active.has(line.number)) {
            const text = doc.sliceString(node.from, node.to)
            const m = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)$/.exec(text)
            if (m) {
              // Center a paragraph that is just an image (Typora behaviour).
              if (node.from === line.from && node.to === line.to) {
                decos.push(Decoration.line({ class: 'ink-img-line' }).range(line.from))
              }
              decos.push(
                Decoration.replace({
                  widget: new ImageWidget(m[2], m[1], docPath, undefined, node.from, node.to)
                }).range(node.from, node.to)
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
              Decoration.replace({ widget: new TableWidget(md), block: true }).range(
                node.from,
                node.to
              )
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
            decos.push(
              Decoration.replace({ widget: new HtmlBlockWidget(html), block: true }).range(
                node.from,
                node.to
              )
            )
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
          if (lang === 'mermaid' && !blockActive && code.trim()) {
            const dark = useAppStore.getState().theme === 'dark'
            decos.push(Decoration.line({ class: 'ink-img-line' }).range(first.from))
            decos.push(
              Decoration.replace({ widget: new MermaidWidget(code, dark), block: true }).range(
                node.from,
                node.to
              )
            )
            return false
          }

          // Hide the ``` fence lines on idle blocks (Typora-style) so the panel
          // reads like rendered code; reveal them raw when the caret is inside.
          // Needs at least one code line between the fences.
          const hideFences = !blockActive && last.number >= first.number + 2
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
            Decoration.widget({ widget: new CodeBadgeWidget(lang, code), side: 1 }).range(badgePos)
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
        //     A `> [!NOTE]` first line turns it into a GitHub-style alert.
        if (name === 'Blockquote') {
          const firstLine = doc.lineAt(node.from)
          const first = firstLine.number
          const last = doc.lineAt(node.to).number
          const alert = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(firstLine.text)
          const alertType = alert ? alert[1].toLowerCase() : null

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
                Decoration.replace({ widget: new AlertLabelWidget(alertType) }).range(from, to)
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
    htmlImageDecos(slice, from, active, doc, docPath, decos)
    mathDecos(slice, from, active, doc, decos)
    footnoteDecos(slice, from, active, doc, fnDefs, decos)
    tocDecos(slice, from, active, doc, tocHeadings, decos)
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
  const docPath = useAppStore.getState().doc.path
  return buildDecorations(state, [{ from: 0, to: state.doc.length }], activeLines(state), docPath)
}

export const livePreview = StateField.define<DecorationSet>({
  create: (state) => computeDecorations(state),
  update(value, tr) {
    if (!tr.docChanged && !tr.selection) return value
    return computeDecorations(tr.state)
  },
  provide: (f) => EditorView.decorations.from(f)
})
