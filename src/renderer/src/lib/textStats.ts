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

export interface GoalProgress {
  /** Completion percentage, clamped 0–100. */
  pct: number
  /** Words still to write to reach the goal (never negative). */
  remaining: number
  /** Whether the goal has been met. */
  done: boolean
}

/**
 * Progress toward a word-count goal. Returns null when no goal is set
 * (`null`/`0`/negative), so callers can branch on a single value.
 */
export function goalProgress(words: number, goal: number | null): GoalProgress | null {
  if (!goal || goal <= 0) return null
  const pct = Math.min(100, Math.round((words / goal) * 100))
  return { pct, remaining: Math.max(0, goal - words), done: words >= goal }
}
