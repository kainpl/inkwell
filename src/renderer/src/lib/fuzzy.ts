/** Minimal subsequence fuzzy matcher for the quick-open file switcher. */

export interface FuzzyResult<T> {
  item: T
  score: number
}

/**
 * Score `query` against `text` as a case-insensitive subsequence match.
 * Returns -1 when not all query chars appear in order. Higher is better;
 * consecutive matches and start-of-word matches score more.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (q === '') return 0
  let qi = 0
  let score = 0
  let prevMatch = -2
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1
      if (ti === prevMatch + 1) score += 2 // consecutive run bonus
      if (ti === 0 || /[\s/\\._-]/.test(t[ti - 1])) score += 3 // word-boundary bonus
      prevMatch = ti
      qi++
    }
  }
  return qi === q.length ? score : -1
}

/** Filter+rank items by fuzzy match of `query` against `key(item)`. */
export function fuzzyFilter<T>(items: T[], query: string, key: (item: T) => string): T[] {
  if (query.trim() === '') return items
  const scored: FuzzyResult<T>[] = []
  for (const item of items) {
    const score = fuzzyScore(query, key(item))
    if (score >= 0) scored.push({ item, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.item)
}
