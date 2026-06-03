/**
 * Pure text generators: a schema outline → OPML / plain Markdown / FreeMind `.mm`.
 * The symmetric counterparts of `importFormats.ts` — each output re-imports through
 * the matching parser. Read-only over the outline (no data mutated); all text is
 * XML/markdown-escaped. Wired via the generic `inkproj:exportText` save dialog.
 */

import type { MarkdownNode } from '@shared/mindmap/types'

const oneLine = (s: string): string => (s ?? '').replace(/\r?\n+/g, ' ').trim()

/** Escape for an XML attribute value (quotes + the markup chars + control whitespace). */
const xmlAttr = (s: string): string =>
  oneLine(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/** Escape for XML text content. */
const xmlText = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const indent = (depth: number): string => '  '.repeat(depth)

/** Unwrap an implicit root (single top node whose name == title) for heading-style output. */
function unwrapRoot(outline: MarkdownNode[], title?: string): MarkdownNode[] {
  if (title && outline.length === 1 && oneLine(outline[0].name) === oneLine(title)) {
    return outline[0].children ?? []
  }
  return outline
}

// ── Markdown (plain nested bullets, no `<!-- mindmap -->` data) ───────────────

/** Title as `# H1`, the tree as 2-space-indented bullets. Re-imports via `parseMarkdown`. */
export function toPlainMarkdown(outline: MarkdownNode[], title?: string): string {
  const lines: string[] = []
  if (title && title.trim()) {
    lines.push(`# ${oneLine(title)}`, '')
  }
  const walk = (nodes: MarkdownNode[], depth: number): void => {
    for (const n of nodes) {
      lines.push(`${indent(depth)}- ${oneLine(n.name)}`)
      if (n.children?.length) walk(n.children, depth + 1)
    }
  }
  walk(unwrapRoot(outline, title), 0)
  return lines.join('\n').trimEnd() + '\n'
}

// ── OPML 2.0 ─────────────────────────────────────────────────────────────────

/** Title in `<head>`, the tree as nested `<outline text="…">`. Re-imports via `parseOpml`. */
export function toOpml(title: string, outline: MarkdownNode[]): string {
  const node = (n: MarkdownNode, depth: number): string => {
    const pad = indent(depth + 2)
    const note = typeof n.data?.note === 'string' ? n.data.note : ''
    const attrs = `text="${xmlAttr(n.name)}"${note ? ` _note="${xmlAttr(note)}"` : ''}`
    const kids = n.children ?? []
    if (!kids.length) return `${pad}<outline ${attrs}/>`
    return `${pad}<outline ${attrs}>\n${kids
      .map((k) => node(k, depth + 1))
      .join('\n')}\n${pad}</outline>`
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    `    <title>${xmlText(oneLine(title))}</title>`,
    '  </head>',
    '  <body>',
    ...outline.map((n) => node(n, 0)),
    '  </body>',
    '</opml>',
    ''
  ].join('\n')
}

// ── FreeMind .mm (single-rooted) ─────────────────────────────────────────────

/** A single `<map>` root (synthesised from the title if the outline is a forest),
 *  carrying `COLOR`/`BACKGROUND_COLOR`/`FOLDED`. Re-imports via `parseFreeMind`. */
export function toFreeMind(title: string, outline: MarkdownNode[]): string {
  const root: MarkdownNode =
    outline.length === 1 ? outline[0] : { name: oneLine(title) || 'Mind Map', children: outline }
  const node = (n: MarkdownNode, depth: number): string => {
    const pad = indent(depth + 1)
    const d = n.data ?? {}
    const parts = [`TEXT="${xmlAttr(n.name)}"`]
    if (typeof d.color === 'string') parts.push(`COLOR="${xmlAttr(d.color)}"`)
    if (typeof d.fillColor === 'string') parts.push(`BACKGROUND_COLOR="${xmlAttr(d.fillColor)}"`)
    if (d.expand === false) parts.push('FOLDED="true"')
    const attrs = parts.join(' ')
    const kids = n.children ?? []
    if (!kids.length) return `${pad}<node ${attrs}/>`
    return `${pad}<node ${attrs}>\n${kids.map((k) => node(k, depth + 1)).join('\n')}\n${pad}</node>`
  }
  return ['<map version="1.0.1">', node(root, 0), '</map>', ''].join('\n')
}
