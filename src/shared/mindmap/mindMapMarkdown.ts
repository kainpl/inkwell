/**
 * Mind-map outline ⇄ Markdown conversion — the `.mind-map` schema format.
 *
 * Ported from the source ecosystem (AI-Protokolist
 * `libs/shared/src/mind-map-markdown.ts`). A single file per map: markdown with
 * YAML frontmatter + an `# H1` + a nested bullet list, where each node's
 * lossless `data` bag rides in a trailing `<!-- mindmap {...} -->` HTML comment.
 * Renders as ordinary markdown in Obsidian / GitHub / Notion (the comments are
 * invisible there); we re-hydrate the per-node data on read.
 *
 * Two source-only couplings were dropped in the port: task-metadata
 * normalization (handled in a later milestone) and the public format-spec URL
 * stamp.
 */

import type { MarkdownNode } from './types'

interface FrontMatter {
  title?: string
  createdAt?: string
  [key: string]: unknown
}

export interface MarkdownToOutlineOptions {
  /** Called once per malformed `<!-- mindmap {...} -->` block instead of dropping silently. */
  onWarn?: (message: string) => void
}

const INDENT = '  '
const BULLET = '- '
const META_OPEN = '<!-- mindmap '
const META_CLOSE = ' -->'
/** Zero-width space — keeps an empty-named node alive through a round-trip. */
const EMPTY_NAME_TOKEN = String.fromCharCode(0x200b)
/** SOH control char — in-name `\n` sentinel (sanitizeLine only strips real `\n`). */
const NEWLINE_ESCAPE = String.fromCharCode(0x01)

// ---------------------------------------------------------------------
// Markdown (human-readable)
// ---------------------------------------------------------------------

/** Convert an outline tree to markdown: YAML frontmatter + H1 + nested bullets. */
export function outlineToMarkdown(
  outline: MarkdownNode[],
  title?: string,
  meta: Record<string, unknown> = {}
): string {
  const frontMatter: FrontMatter = {
    title: (title != null ? String(title).trim() : '') || undefined,
    createdAt: (meta.createdAt as string) || undefined,
    ...meta
  }

  const lines: string[] = []
  lines.push('---')
  for (const [key, value] of Object.entries(frontMatter)) {
    if (value === undefined || value === null) continue
    lines.push(`${key}: ${yamlScalar(value)}`)
  }
  lines.push('---')
  lines.push('')

  const implicitRoot = pickImplicitRoot(outline, frontMatter.title)

  if (frontMatter.title) {
    const rootMeta = implicitRoot ? encodeNodeMeta(implicitRoot.data) : null
    const metaSuffix = rootMeta ? ` ${META_OPEN}${rootMeta}${META_CLOSE}` : ''
    lines.push(`# ${sanitizeLine(frontMatter.title)}${metaSuffix}`)
    lines.push('')
  }
  const topLevel = implicitRoot ? (implicitRoot.children ?? []) : outline
  for (const node of topLevel) appendNode(lines, node, 0)

  return lines.join('\n').trimEnd() + '\n'
}

/** The implicit-root contract: title set AND a single top node whose name == title. */
function pickImplicitRoot(outline: MarkdownNode[], title: string | undefined): MarkdownNode | null {
  if (!title || outline.length !== 1) return null
  const root = outline[0]
  if (sanitizeLine(root.name ?? '') !== sanitizeLine(title)) return null
  return root
}

function appendNode(lines: string[], node: MarkdownNode, depth: number): void {
  const meta = encodeNodeMeta(node.data)
  const suffix = meta ? ` ${META_OPEN}${meta}${META_CLOSE}` : ''
  const labelSrc = (node.name ?? '').replace(/\r?\n/g, NEWLINE_ESCAPE)
  const label = sanitizeLine(labelSrc)
  const text = label || EMPTY_NAME_TOKEN
  lines.push(`${INDENT.repeat(depth)}${BULLET}${text}${suffix}`)
  for (const child of node.children ?? []) appendNode(lines, child, depth + 1)
}

/** Serialise a node's `data` bag as JSON for the trailing HTML comment, or null. */
function encodeNodeMeta(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null
  const pruned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v) && v.length === 0) continue
    pruned[k] = v
  }
  if (Object.keys(pruned).length === 0) return null
  return JSON.stringify(pruned).replace(/-->/g, '-\\u002d>')
}

function sanitizeLine(text: string): string {
  return text.replace(/\r?\n+/g, ' ').trim()
}

function yamlScalar(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const str = String(value)
  if (/[:#\n&*!|>'"%@`]/.test(str) || /^\s|\s$/.test(str)) return JSON.stringify(str)
  return str
}

// ---------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------

/** Parse a `.mind-map` document into an outline tree (dual-shape aware). */
export function markdownToOutline(
  md: string,
  opts: MarkdownToOutlineOptions = {}
): { title: string; outline: MarkdownNode[]; meta: FrontMatter } {
  const normalized = md.replace(/\r\n/g, '\n')
  const meta = extractFrontMatter(normalized)
  const body = stripFrontMatter(normalized)
  const h1 = extractH1WithMeta(body, opts.onWarn)
  const roots = parseBulletList(body, opts.onWarn)
  const title = (meta.title as string) || h1.title || ''

  const titleNorm = sanitizeLine(title)
  const hasLegacyRoot =
    titleNorm !== '' && roots.length === 1 && sanitizeLine(roots[0].name ?? '') === titleNorm

  let outline: MarkdownNode[]
  if (titleNorm === '' || hasLegacyRoot || roots.length === 0) {
    outline = roots
  } else {
    const syntheticRoot: MarkdownNode = { name: title, children: roots }
    if (h1.data) syntheticRoot.data = h1.data
    outline = [syntheticRoot]
  }

  return { title, outline, meta }
}

function extractH1WithMeta(
  md: string,
  onWarn?: (message: string) => void
): { title: string; data?: Record<string, unknown> } {
  const m = /^#\s+(.*)$/m.exec(md)
  if (!m) return { title: '' }
  const line = m[1]
  const metaMatch = /\s*<!--\s*mindmap\s+(.+?)\s*-->\s*$/.exec(line)
  if (!metaMatch) return { title: line.trim() }
  const name = line.slice(0, metaMatch.index).trim()
  const data = decodeNodeMeta(metaMatch[1], `H1 "${name}"`, onWarn)
  return data ? { title: name, data } : { title: name }
}

function decodeNodeMeta(
  raw: string,
  context: string,
  onWarn?: (message: string) => void
): Record<string, unknown> | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    onWarn?.(`invalid JSON in mindmap meta at ${context}: ${(err as Error).message}`)
    return undefined
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    onWarn?.(
      `invalid mindmap meta at ${context}: expected object, got ${
        Array.isArray(parsed) ? 'array' : typeof parsed
      }`
    )
    return undefined
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'function' || typeof v === 'undefined') continue
    out[k] = v
  }
  return out
}

function extractFrontMatter(md: string): FrontMatter {
  if (!md.startsWith('---\n')) return {}
  const end = md.indexOf('\n---', 4)
  if (end < 0) return {}
  const body = md.slice(4, end)
  const out: FrontMatter = {}
  for (const raw of body.split('\n')) {
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(raw)
    if (!m) continue
    const key = m[1]
    let value: unknown = m[2].trim()
    if (typeof value === 'string') {
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        try {
          value = JSON.parse(value.replace(/^'|'$/g, '"'))
        } catch {
          /* keep raw */
        }
      } else if (/^(true|false)$/i.test(value)) {
        value = value.toLowerCase() === 'true'
      } else if (/^-?\d+(\.\d+)?$/.test(value)) {
        value = Number(value)
      }
    }
    out[key] = value
  }
  return out
}

function stripFrontMatter(md: string): string {
  if (!md.startsWith('---\n')) return md
  const end = md.indexOf('\n---', 4)
  if (end < 0) return md
  return md.slice(end + 4).replace(/^\n/, '')
}

function parseBulletList(md: string, onWarn?: (message: string) => void): MarkdownNode[] {
  const roots: MarkdownNode[] = []
  const stack: Array<{ node: MarkdownNode; cols: number }> = []

  for (const raw of md.split('\n')) {
    if (!raw.trim()) continue
    const bullet = /^(\s*)([-*])\s+(.*)$/.exec(raw)
    if (!bullet) continue

    const cols = bullet[1].replace(/\t/g, '  ').length
    const rest = bullet[3]
    const meta = /\s*<!--\s*mindmap\s+(.+?)\s*-->\s*$/.exec(rest)
    const rawName = (meta ? rest.slice(0, meta.index) : rest).trim()
    const name =
      rawName === EMPTY_NAME_TOKEN ? '' : rawName.split(NEWLINE_ESCAPE).join('\n')
    const data = meta
      ? decodeNodeMeta(meta[1], `bullet "${name || '<empty>'}"`, onWarn)
      : undefined

    while (stack.length && stack[stack.length - 1].cols >= cols) stack.pop()

    const node: MarkdownNode = { name, children: [] }
    if (data) node.data = data
    if (stack.length === 0) {
      roots.push(node)
    } else {
      const parent = stack[stack.length - 1].node
      ;(parent.children = parent.children ?? []).push(node)
    }
    stack.push({ node, cols })
  }
  return roots
}
