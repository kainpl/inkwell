import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import type { MarkdownNode, NodeData } from '@shared/mindmap/types'

export interface ImportResult {
  title: string
  outline: MarkdownNode[]
}

/** Extensions `importAny` understands (binary `.mindnode` handled separately). */
export const SUPPORTED_IMPORT_EXTENSIONS = [
  '.mind-map',
  '.mind-doc',
  '.mm',
  '.opml',
  '.md',
  '.markdown',
  '.txt',
  '.json'
]

/**
 * Convert a source mind-map file's text into our `{ title, outline }`.
 * Dispatch by extension; unknown text falls back to the markdown parser.
 * Adapted from the source ecosystem's client importer (we inherit it — §1a).
 */
export function importAny(name: string, text: string): ImportResult {
  const lower = name.toLowerCase()
  const ext = lower.endsWith('.mind-map') || lower.endsWith('.mind-doc')
    ? 'mind-map'
    : (lower.split('.').pop() ?? '')
  let result: ImportResult
  switch (ext) {
    case 'mind-map':
      result = parseMindDoc(text, name)
      break
    case 'mm':
      result = parseFreeMind(text)
      break
    case 'opml':
      result = parseOpml(text)
      break
    case 'json':
      result = parseJson(text, name)
      break
    case 'txt':
      result = parseIndented(text, name)
      break
    case 'md':
    case 'markdown':
    default:
      result = parseMarkdown(text, name)
      break
  }
  result.outline = cleanTree(result.outline)
  collapseDeep(result.outline, 0)
  return result
}

// ── helpers ───────────────────────────────────────────────────────────────

const push = (parent: MarkdownNode, child: MarkdownNode): void => {
  ;(parent.children ??= []).push(child)
}
const fileNameToTitle = (name: string): string =>
  name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Mind Map'
const gcd = (a: number, b: number): number => {
  while (b) [a, b] = [b, a % b]
  return a
}
const directChildren = (el: Element, tag: string): Element[] =>
  Array.from(el.children).filter((c) => c.tagName.toLowerCase() === tag.toLowerCase())
const directChild = (el: Element, tag: string): Element | null =>
  directChildren(el, tag).at(0) ?? null

/** Keys that keep an empty-text node alive (semantic, not pure chrome). */
const SEMANTIC_KEYS = new Set(['icon', 'tag', 'task', 'taskStatus', 'docs', 'links', 'note'])

/** Drop empty leaves (no text, no children, no semantic data); trim names. */
function cleanTree(nodes: MarkdownNode[]): MarkdownNode[] {
  const out: MarkdownNode[] = []
  for (const node of nodes) {
    const name = (node.name ?? '').trim()
    const children = node.children?.length ? cleanTree(node.children) : undefined
    const semantic =
      node.data != null && Object.keys(node.data).some((k) => SEMANTIC_KEYS.has(k))
    if (!name && !children?.length && !semantic) continue
    out.push({ ...node, name, children: children?.length ? children : undefined })
  }
  return out
}

/** Collapse imported subtrees: `expand:false` on every node at depth ≥ 1 with children. */
function collapseDeep(nodes: MarkdownNode[], depth: number): void {
  for (const node of nodes) {
    if (depth >= 1 && node.children?.length) node.data = { ...node.data, expand: false }
    if (node.children) collapseDeep(node.children, depth + 1)
  }
}

// ── .mind-map / .mind-doc (native, lossless) ────────────────────────────────

function parseMindDoc(text: string, fileName: string): ImportResult {
  const { title, outline } = markdownToOutline(text)
  return { title: title || fileName.replace(/\.(mind-map|mind-doc)$/i, ''), outline }
}

// ── FreeMind .mm (also Freeplane / legacy XMind / MindMeister / Coggle) ──────

function parseFreeMind(xml: string): ImportResult {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid .mm file: malformed XML')
  const map = doc.querySelector('map')
  const root = map ? directChild(map, 'node') : null
  if (!root) throw new Error('Not a FreeMind .mm file: missing root <node>')

  const textAttr = (el: Element): string => el.getAttribute('TEXT') ?? el.getAttribute('text') ?? ''
  const richText = (el: Element): string => {
    const rc = directChild(el, 'richcontent')
    return rc ? rc.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''
  }

  const convert = (el: Element): MarkdownNode | null => {
    const name = textAttr(el) || richText(el)
    if (!name.trim()) return null
    const data: NodeData = {}
    const color = el.getAttribute('COLOR')
    const bg = el.getAttribute('BACKGROUND_COLOR')
    const edgeColor = directChild(el, 'edge')?.getAttribute('COLOR') ?? null
    if (color && /^#(?:fff|ffffff)$/i.test(color) && edgeColor) {
      data.fillColor = edgeColor
      data.color = '#ffffff'
    } else {
      if (color) data.color = color
      if (bg && bg.toUpperCase() !== '#FFFFFF') data.fillColor = bg
    }
    if (edgeColor) data.lineColor = edgeColor
    if (/bubble/i.test(el.getAttribute('STYLE') ?? '')) data.shape = 'rounded'
    if (el.getAttribute('FOLDED') === 'true') data.expand = false
    const children = directChildren(el, 'node')
      .map(convert)
      .filter((n): n is MarkdownNode => n !== null)
    return { name, data: Object.keys(data).length ? data : undefined, children }
  }

  const rootNode = convert(root)
  const title = rootNode?.name || textAttr(root) || 'Mind Map'
  return { title, outline: rootNode ? [rootNode] : [] }
}

// ── OPML ────────────────────────────────────────────────────────────────────

function parseOpml(xml: string): ImportResult {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid .opml file: malformed XML')
  const title = doc.querySelector('head > title')?.textContent?.trim() || 'Mind Map'
  const body = doc.querySelector('body')
  if (!body) throw new Error('Not an OPML file: missing <body>')

  const convert = (el: Element): MarkdownNode | null => {
    const name = el.getAttribute('text') ?? el.getAttribute('title') ?? ''
    if (!name.trim()) return null
    const children = directChildren(el, 'outline')
      .map(convert)
      .filter((n): n is MarkdownNode => n !== null)
    const note = el.getAttribute('_note')
    return { name, children, data: note ? { note } : undefined }
  }

  const outline = directChildren(body, 'outline')
    .map(convert)
    .filter((n): n is MarkdownNode => n !== null)
  return { title, outline }
}

// ── Markdown (headings + bullets) ────────────────────────────────────────────

function stripMdInline(s: string): string {
  return s
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/(^|[^*])\*(?!\*)([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMarkdown(text: string, fileName: string): ImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim())
  if (!lines.length) return { title: fileNameToTitle(fileName), outline: [] }

  let title = fileNameToTitle(fileName)
  let outline: MarkdownNode[] = []
  const headingStack: { level: number; node: MarkdownNode }[] = []
  let bulletContext: MarkdownNode | null = null
  const bulletStack: { indent: number; node: MarkdownNode }[] = []

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)/)
    if (h) {
      const level = h[1].length
      const name = stripMdInline(h[2].trim())
      if (level === 1 && !outline.length && !headingStack.length) {
        title = name
        continue
      }
      const node: MarkdownNode = { name, children: [] }
      while ((headingStack.at(-1)?.level ?? 0) >= level) headingStack.pop()
      const parent = headingStack.at(-1)
      if (parent) push(parent.node, node)
      else outline.push(node)
      headingStack.push({ level, node })
      bulletContext = node
      bulletStack.length = 0
      continue
    }
    const b = line.match(/^(\s*)[-*+]\s+(.+)/)
    if (b) {
      const indent = b[1].length
      const node: MarkdownNode = { name: stripMdInline(b[2].trim()), children: [] }
      while ((bulletStack.at(-1)?.indent ?? -1) >= indent) bulletStack.pop()
      const parent = bulletStack.at(-1)
      if (parent) push(parent.node, node)
      else if (bulletContext) push(bulletContext, node)
      else outline.push(node)
      bulletStack.push({ indent, node })
    }
  }

  // A single H1 + multiple H2 sections is a forest; re-root it under the title.
  if (outline.length > 1 && title) outline = [{ name: title, children: outline }]
  return { title, outline }
}

// ── Plain indented text ──────────────────────────────────────────────────────

function parseIndented(text: string, fileName: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { title: fileNameToTitle(fileName), outline: [] }
  const indents = new Set<number>()
  for (const line of lines) {
    const indent = line.length - line.trimStart().length
    if (indent > 0) indents.add(indent)
  }
  const unit = indents.size ? [...indents].sort((a, b) => a - b).reduce((a, b) => gcd(a, b)) : 2

  let title = fileNameToTitle(fileName)
  const outline: MarkdownNode[] = []
  const stack: { depth: number; node: MarkdownNode }[] = []
  let first = true

  for (const line of lines) {
    const raw = line.length - line.trimStart().length
    const depth = unit > 0 ? Math.floor(raw / unit) : 0
    const name = line.trim().replace(/^[-*+]\s*/, '')
    if (!name) continue
    if (first && depth === 0) {
      title = name
      first = false
      continue
    }
    const node: MarkdownNode = { name, children: [] }
    while ((stack.at(-1)?.depth ?? -1) >= depth) stack.pop()
    const parent = stack.at(-1)
    if (parent) push(parent.node, node)
    else outline.push(node)
    stack.push({ depth, node })
  }
  return { title, outline }
}

// ── JSON ─────────────────────────────────────────────────────────────────────

function parseJson(text: string, fileName: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid .json file: could not parse JSON')
  }
  if (Array.isArray(data)) return { title: fileNameToTitle(fileName), outline: normalizeJson(data) }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const title = typeof obj.title === 'string' ? obj.title : fileNameToTitle(fileName)
    const raw = obj.outline ?? obj.branches ?? obj.children ?? []
    return { title, outline: normalizeJson(Array.isArray(raw) ? raw : []) }
  }
  throw new Error('Invalid JSON mind map structure')
}

function normalizeJson(nodes: unknown[]): MarkdownNode[] {
  return nodes.map((raw) => {
    const n = (raw ?? {}) as Record<string, unknown>
    const children = Array.isArray(n.children) ? normalizeJson(n.children) : []
    const data = n.data && typeof n.data === 'object' ? (n.data as NodeData) : undefined
    return { name: String(n.name ?? n.text ?? ''), children, data }
  })
}
