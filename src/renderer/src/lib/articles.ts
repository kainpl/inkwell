import type { ArticleEntry } from '@shared/ipc'

export type ArticleSort = 'name' | 'modified'

/** Case-insensitive name filter. */
export function filterArticles(articles: ArticleEntry[], query: string): ArticleEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return articles
  return articles.filter((a) => a.name.toLowerCase().includes(q))
}

/** Return a sorted copy: by name (A→Z) or by modified time (newest first). */
export function sortArticles(articles: ArticleEntry[], sort: ArticleSort): ArticleEntry[] {
  const copy = articles.slice()
  if (sort === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name))
  } else {
    copy.sort((a, b) => b.mtime - a.mtime)
  }
  return copy
}

/** Filter then sort, in one call. */
export function prepareArticles(
  articles: ArticleEntry[],
  query: string,
  sort: ArticleSort
): ArticleEntry[] {
  return sortArticles(filterArticles(articles, query), sort)
}

/** Compact relative-time label (e.g. "2h", "3d", "5mo"). */
export function relativeTime(mtime: number, now: number): string {
  const sec = Math.max(0, Math.round((now - mtime) / 1000))
  if (sec < 60) return 'now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.round(mo / 12)}y`
}
