import { THEMES, isDarkTheme, isKnownTheme } from './themes'

describe('themes registry', () => {
  it('includes the base light and dark themes', () => {
    expect(isKnownTheme('light')).toBe(true)
    expect(isKnownTheme('dark')).toBe(true)
  })

  it('flags dark-based themes', () => {
    expect(isDarkTheme('dark')).toBe(true)
    expect(isDarkTheme('night')).toBe(true)
    expect(isDarkTheme('github')).toBe(false)
    expect(isDarkTheme('light')).toBe(false)
  })

  it('treats an unknown id as unknown / light', () => {
    expect(isKnownTheme('nope')).toBe(false)
    expect(isDarkTheme('nope')).toBe(false)
  })

  it('has unique ids and a non-empty label for every theme', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(THEMES.every((t) => t.label.length > 0)).toBe(true)
  })
})
