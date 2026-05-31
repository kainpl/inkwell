import { addRecent, removeRecent, baseName } from './recentFiles'

describe('recentFiles', () => {
  it('adds to the front, newest first', () => {
    expect(addRecent(['a', 'b'], 'c')).toEqual(['c', 'a', 'b'])
  })

  it('de-duplicates, moving an existing entry to the front', () => {
    expect(addRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
  })

  it('caps the list to the max length', () => {
    const long = Array.from({ length: 12 }, (_, i) => `f${i}`)
    const r = addRecent(long, 'new', 12)
    expect(r).toHaveLength(12)
    expect(r[0]).toBe('new')
    expect(r).not.toContain('f11')
  })

  it('removes a path', () => {
    expect(removeRecent(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('extracts basenames from both separators', () => {
    expect(baseName('/home/u/notes.md')).toBe('notes.md')
    expect(baseName('D:\\docs\\readme.md')).toBe('readme.md')
    expect(baseName('plain.md')).toBe('plain.md')
  })
})
