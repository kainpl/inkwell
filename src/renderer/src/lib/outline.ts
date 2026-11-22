import { EditorView } from '@codemirror/view'

export interface Heading {
  level: number
  text: string
  /** Character offset of the line start in the document. */
  from: number
  /** Explicit `{#id}` if present, else undefined. */
  id?: string
}

/** Move the caret to `from` and scroll it to the top — used by the outline panel
 *  to reveal a heading in the editor. Keeps CodeMirror usage inside the lib. */
export function revealInEditor(view: EditorView, from: number): void {
  view.dispatch({
    selection: { anchor: from },
    effects: EditorView.scrollIntoView(from, { y: 'start' }),
  })
  view.focus()
}

/**
 * Extract ATX headings (#, ##, …) from markdown.
 * Ignores `#` inside fenced code blocks.
 */
export function parseOutline(content: string): Heading[] {
  const headings: Heading[] = []
  const lines = content.split(/\r\n?|\n/)
  let offset = 0
  let inFence = false

  for (const line of lines) {
    const fence = line.match(/^\s*(```|~~~)/)
    if (fence) inFence = !inFence

    if (!inFence) {
      const m = line.match(/^(#{1,6})\s+(.*)$/)
      const hashes = m?.[1]
      const rest = m?.[2]
      if (hashes !== undefined && rest !== undefined) {
        const idM = /\{#([\w-]+)\}\s*$/.exec(rest)
        headings.push({
          level: hashes.length,
          text: rest
            .replace(/\s*\{#[\w-]+\}\s*$/, '')
            .replace(/#+\s*$/, '')
            .trim(),
          from: offset,
          id: idM ? idM[1] : undefined,
        })
      }
    }
    offset += line.length + 1 // +1 for the consumed '\n'
  }

  return headings
}
