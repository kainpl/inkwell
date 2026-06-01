import { misspelledRanges } from './spellCheck'

const check = (w: string): boolean => ['hello', 'world'].includes(w.toLowerCase())

describe('misspelledRanges', () => {
  it('flags words the checker rejects, with offsets', () => {
    expect(misspelledRanges('hello wrld', 0, check)).toEqual([{ from: 6, to: 10 }])
  })

  it('applies the base offset', () => {
    expect(misspelledRanges('wrld', 100, check)).toEqual([{ from: 100, to: 104 }])
  })

  it('skips single-letter tokens and correctly-spelled words', () => {
    expect(misspelledRanges('a hello world', 0, check)).toEqual([])
  })

  it('returns multiple ranges in order', () => {
    expect(misspelledRanges('foo world bar', 0, check)).toEqual([
      { from: 0, to: 3 },
      { from: 10, to: 13 }
    ])
  })
})
