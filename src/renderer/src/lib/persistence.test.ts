import { getCaret, setCaret } from './persistence'

beforeEach(() => localStorage.clear())

describe('caret persistence', () => {
  it('round-trips a caret offset per path', () => {
    setCaret('/a.md', 42)
    expect(getCaret('/a.md')).toBe(42)
    expect(getCaret('/b.md')).toBeUndefined()
  })

  it('overwrites the offset for a path', () => {
    setCaret('/a.md', 1)
    setCaret('/a.md', 9)
    expect(getCaret('/a.md')).toBe(9)
  })

  it('evicts the oldest entries beyond the cap', () => {
    for (let i = 0; i < 250; i++) setCaret(`/f${i}.md`, i)
    expect(getCaret('/f0.md')).toBeUndefined() // evicted
    expect(getCaret('/f249.md')).toBe(249) // kept
  })
})
