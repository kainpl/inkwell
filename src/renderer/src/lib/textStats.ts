/** Pure text statistics for the status bar and word-count popover. */

export interface TextStats {
  words: number
  chars: number
  /** Characters excluding whitespace. */
  charsNoSpaces: number
  lines: number
  /** Estimated reading time in minutes (>=1 for any non-empty text). */
  readingMinutes: number
}

/** Average adult reading speed (words per minute) used for the estimate. */
const WORDS_PER_MINUTE = 200

export function computeStats(text: string): TextStats {
  const words = text.trim().match(/\S+/g)?.length ?? 0
  const chars = text.length
  const charsNoSpaces = text.replace(/\s/g, '').length
  const lines = text === '' ? 0 : text.split('\n').length
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  return { words, chars, charsNoSpaces, lines, readingMinutes }
}

/** Human label like "1 min read" / "3 min read"; empty string for no text. */
export function readingTimeLabel(minutes: number): string {
  return minutes === 0 ? '' : `${minutes} min read`
}
