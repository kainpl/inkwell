import {
  THEMES,
  isKnownTheme,
  themeEditions,
  clampMode,
  hasBothEditions,
  migrateTheme
} from './themes'

const EXTERNAL = [
  { id: 'lightonly', label: 'Light Only', light: true, dark: false },
  { id: 'darkonly', label: 'Dark Only', light: false, dark: true }
]

describe('themes registry', () => {
  it('knows its built-in ids and rejects others', () => {
    expect(isKnownTheme('inkwell')).toBe(true)
    expect(isKnownTheme('tokyo')).toBe(true)
    expect(isKnownTheme('night')).toBe(false) // renamed
    expect(isKnownTheme('nope')).toBe(false)
  })

  it('reports both editions for every built-in', () => {
    expect(THEMES.every((t) => t.light && t.dark)).toBe(true)
    expect(hasBothEditions('github')).toBe(true)
  })

  it('reads editions from the external list', () => {
    expect(themeEditions('lightonly', EXTERNAL)).toEqual({ light: true, dark: false })
    expect(themeEditions('darkonly', EXTERNAL)).toEqual({ light: false, dark: true })
    expect(hasBothEditions('lightonly', EXTERNAL)).toBe(false)
  })

  it('clamps a requested mode to an available edition', () => {
    expect(clampMode('inkwell', 'dark')).toBe('dark')
    expect(clampMode('lightonly', 'dark', EXTERNAL)).toBe('light') // no dark → light
    expect(clampMode('darkonly', 'light', EXTERNAL)).toBe('dark') // no light → dark
  })

  it('has unique ids and a non-empty label for every theme', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(THEMES.every((t) => t.label.length > 0)).toBe(true)
  })
})

describe('migrateTheme', () => {
  it('folds the old Light/Dark/Night ids into the new model', () => {
    expect(migrateTheme('light', 'light')).toEqual({ theme: 'inkwell', mode: 'light' })
    expect(migrateTheme('dark', 'light')).toEqual({ theme: 'inkwell', mode: 'dark' })
    expect(migrateTheme('night', 'light')).toEqual({ theme: 'tokyo', mode: 'dark' })
  })

  it('keeps a known id and its mode', () => {
    expect(migrateTheme('github', 'dark')).toEqual({ theme: 'github', mode: 'dark' })
  })

  it('resets an unknown id to the default', () => {
    expect(migrateTheme('bogus', 'dark')).toEqual({ theme: 'inkwell', mode: 'light' })
  })
})
