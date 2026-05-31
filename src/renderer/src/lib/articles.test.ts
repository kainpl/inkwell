import { filterArticles, sortArticles, prepareArticles, relativeTime } from './articles'
import type { ArticleEntry } from '@shared/ipc'

const A: ArticleEntry[] = [
  { path: '/x/banana.md', name: 'banana.md', mtime: 100 },
  { path: '/x/apple.md', name: 'apple.md', mtime: 300 },
  { path: '/x/cherry.md', name: 'cherry.md', mtime: 200 }
]

describe('articles', () => {
  it('filters by name, case-insensitive', () => {
    expect(filterArticles(A, 'AN').map((a) => a.name)).toEqual(['banana.md'])
    expect(filterArticles(A, '').length).toBe(3)
  })

  it('sorts by name A→Z', () => {
    expect(sortArticles(A, 'name').map((a) => a.name)).toEqual([
      'apple.md',
      'banana.md',
      'cherry.md'
    ])
  })

  it('sorts by modified, newest first', () => {
    expect(sortArticles(A, 'modified').map((a) => a.name)).toEqual([
      'apple.md',
      'cherry.md',
      'banana.md'
    ])
  })

  it('does not mutate the input array', () => {
    const before = A.map((a) => a.name)
    sortArticles(A, 'name')
    expect(A.map((a) => a.name)).toEqual(before)
  })

  it('filters then sorts in prepareArticles', () => {
    const r = prepareArticles(A, 'a', 'name') // apple, banana (both contain "a")
    expect(r.map((x) => x.name)).toEqual(['apple.md', 'banana.md'])
  })

  it('formats relative time compactly', () => {
    const now = 1_000_000_000_000
    expect(relativeTime(now, now)).toBe('now')
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m')
    expect(relativeTime(now - 3 * 3600_000, now)).toBe('3h')
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d')
  })
})
