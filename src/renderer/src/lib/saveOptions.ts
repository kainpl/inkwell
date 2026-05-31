/** Pure content normalization applied at save time (line endings, final newline). */

export type LineEnding = 'lf' | 'crlf'

export interface SaveOptions {
  lineEnding: LineEnding
  insertFinalNewline: boolean
}

export const DEFAULT_SAVE_OPTIONS: SaveOptions = {
  lineEnding: 'lf',
  insertFinalNewline: true
}

/** Detect the dominant line ending in existing text ('crlf' if any CRLF present). */
export function detectLineEnding(text: string): LineEnding {
  return /\r\n/.test(text) ? 'crlf' : 'lf'
}

/**
 * Normalize `content` for saving: convert all line endings to the chosen style
 * and optionally ensure exactly one trailing newline. The in-memory document
 * always uses `\n`; this only shapes the bytes written to disk.
 */
export function normalizeForSave(content: string, opts: SaveOptions): string {
  // Collapse to LF first so we never double-convert.
  let out = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (opts.insertFinalNewline) {
    out = out.replace(/\n+$/, '') + '\n'
  }
  if (opts.lineEnding === 'crlf') {
    out = out.replace(/\n/g, '\r\n')
  }
  return out
}
