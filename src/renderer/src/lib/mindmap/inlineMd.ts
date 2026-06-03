/**
 * Minimal inline-markdown for node labels: split text into styled segments for
 * `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`. Non-nesting, left-to-right
 * (the longest markers checked first); an unclosed marker stays literal. Authoring
 * stays plain text (the `name`); this only affects rendering.
 */
export interface MdSeg {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  strike?: boolean
}

const MARKS: [string, keyof MdSeg][] = [
  ['**', 'bold'],
  ['~~', 'strike'],
  ['`', 'code'],
  ['*', 'italic']
]

export function inlineMd(text: string): MdSeg[] {
  const out: MdSeg[] = []
  let plain = ''
  const flush = (): void => {
    if (plain) {
      out.push({ text: plain })
      plain = ''
    }
  }
  let i = 0
  while (i < text.length) {
    let matched = false
    for (const [mark, flag] of MARKS) {
      if (!text.startsWith(mark, i)) continue
      const close = text.indexOf(mark, i + mark.length)
      const inner = close > i ? text.slice(i + mark.length, close) : ''
      if (inner.length > 0) {
        flush()
        out.push({ text: inner, [flag]: true })
        i = close + mark.length
        matched = true
        break
      }
    }
    if (!matched) {
      plain += text[i]
      i++
    }
  }
  flush()
  return out
}
