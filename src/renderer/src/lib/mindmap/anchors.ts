export interface AnchorPos {
  /** 0-based line index. */
  line: number
  ch: number
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Resolve an anchor fragment (`#id`) to a position in a markdown doc (D6).
 * Matches a heading carrying `{#id}` or any line ending with `^id`. Returns
 * null when not found (caller opens the doc at top + warns).
 */
export function resolveAnchor(text: string, anchor: string): AnchorPos | null {
  const id = anchor.replace(/^#/, '').trim()
  if (!id) return null
  const headingRe = new RegExp(`\\{#${escapeRe(id)}\\}`)
  const blockRe = new RegExp(`\\^${escapeRe(id)}\\s*$`)
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^#{1,6}\s/.test(line) && headingRe.test(line)) return { line: i, ch: 0 }
    if (blockRe.test(line)) return { line: i, ch: 0 }
  }
  return null
}
