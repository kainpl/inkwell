export interface Heading {
  level: number
  text: string
  /** Character offset of the line start in the document. */
  from: number
}

/**
 * Extract ATX headings (#, ##, …) from markdown.
 * Ignores `#` inside fenced code blocks.
 */
export function parseOutline(content: string): Heading[] {
  const headings: Heading[] = []
  const lines = content.split('\n')
  let offset = 0
  let inFence = false

  for (const line of lines) {
    const fence = line.match(/^\s*(```|~~~)/)
    if (fence) inFence = !inFence

    if (!inFence) {
      const m = line.match(/^(#{1,6})\s+(.*)$/)
      if (m) {
        headings.push({
          level: m[1].length,
          text: m[2].replace(/#+\s*$/, '').trim(),
          from: offset
        })
      }
    }
    offset += line.length + 1 // +1 for the consumed '\n'
  }

  return headings
}
