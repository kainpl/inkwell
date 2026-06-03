import { describe, it, expect } from 'vitest'
import { isCatastrophicShrink } from './saveGuard'

describe('isCatastrophicShrink', () => {
  it('flags a wipe of a non-trivial map', () => {
    expect(isCatastrophicShrink(100, 3)).toBe(true)
    expect(isCatastrophicShrink(40, 5)).toBe(true)
  })
  it('allows ordinary deletions (not majority)', () => {
    expect(isCatastrophicShrink(100, 90)).toBe(false)
    expect(isCatastrophicShrink(100, 60)).toBe(false) // >50% kept
  })
  it('exempts tiny docs (deleting most of a few nodes is normal)', () => {
    expect(isCatastrophicShrink(8, 0)).toBe(false)
    expect(isCatastrophicShrink(9, 1)).toBe(false)
  })
  it('requires both a ratio and an absolute drop', () => {
    expect(isCatastrophicShrink(12, 6)).toBe(false) // 50% but only −6
    expect(isCatastrophicShrink(30, 10)).toBe(true) // <50% and −20
  })
  it('growth or no change is never a shrink', () => {
    expect(isCatastrophicShrink(50, 50)).toBe(false)
    expect(isCatastrophicShrink(50, 80)).toBe(false)
  })
})
