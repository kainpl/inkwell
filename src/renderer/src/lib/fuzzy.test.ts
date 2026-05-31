import { fuzzyScore, fuzzyFilter } from './fuzzy'

describe('fuzzyScore', () => {
  it('matches a subsequence, case-insensitive', () => {
    expect(fuzzyScore('abc', 'A_big_cat')).toBeGreaterThanOrEqual(0)
    expect(fuzzyScore('xyz', 'abc')).toBe(-1)
  })

  it('rewards consecutive and word-boundary matches', () => {
    // "read" as a prefix word beats scattered letters.
    expect(fuzzyScore('read', 'readme.md')).toBeGreaterThan(fuzzyScore('read', 'r_e_a_d.md'))
  })

  it('empty query scores zero (matches anything)', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })
})

describe('fuzzyFilter', () => {
  const files = ['readme.md', 'notes.md', 'roadmap.md', 'changelog.md']

  it('keeps only matches and ranks them', () => {
    const r = fuzzyFilter(files, 'rd', (f) => f)
    expect(r).toContain('roadmap.md')
    expect(r).not.toContain('notes.md')
  })

  it('ranks a closer match first', () => {
    const r = fuzzyFilter(files, 'read', (f) => f)
    expect(r[0]).toBe('readme.md')
  })

  it('returns all items for an empty query', () => {
    expect(fuzzyFilter(files, '', (f) => f)).toHaveLength(4)
  })
})
