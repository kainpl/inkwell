import { computeStats, readingTimeLabel } from './textStats'

describe('computeStats', () => {
  it('counts words, chars, non-space chars and lines', () => {
    const s = computeStats('hello world\nsecond line')
    expect(s.words).toBe(4)
    expect(s.chars).toBe(23)
    expect(s.charsNoSpaces).toBe(20)
    expect(s.lines).toBe(2)
  })

  it('returns zeros for empty text', () => {
    expect(computeStats('')).toEqual({
      words: 0,
      chars: 0,
      charsNoSpaces: 0,
      lines: 0,
      readingMinutes: 0
    })
  })

  it('reports at least 1 reading minute for any non-empty text', () => {
    expect(computeStats('a few words here').readingMinutes).toBe(1)
  })

  it('scales reading time with length (~200 wpm)', () => {
    const text = Array.from({ length: 600 }, () => 'word').join(' ')
    expect(computeStats(text).readingMinutes).toBe(3)
  })
})

describe('readingTimeLabel', () => {
  it('formats minutes, empty for zero', () => {
    expect(readingTimeLabel(0)).toBe('')
    expect(readingTimeLabel(1)).toBe('1 min read')
    expect(readingTimeLabel(5)).toBe('5 min read')
  })
})
