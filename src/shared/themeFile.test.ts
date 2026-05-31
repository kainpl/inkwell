import {
  isValidThemeId,
  isThemeFile,
  themeIdFromFile,
  themeIdToLabel,
  parseThemeEditions
} from './themeFile'

describe('themeFile helpers', () => {
  it('rejects ids with separators or traversal', () => {
    expect(isValidThemeId('solarized')).toBe(true)
    expect(isValidThemeId('../etc/passwd')).toBe(false)
    expect(isValidThemeId('a/b')).toBe(false)
    expect(isValidThemeId('a\\b')).toBe(false)
    expect(isValidThemeId('  ')).toBe(false)
  })

  it('selects .css but not *.user.css or other files', () => {
    expect(isThemeFile('night.css')).toBe(true)
    expect(isThemeFile('Night.CSS')).toBe(true)
    expect(isThemeFile('base.user.css')).toBe(false)
    expect(isThemeFile('night.user.css')).toBe(false)
    expect(isThemeFile('README.txt')).toBe(false)
  })

  it('derives id and label from a filename', () => {
    expect(themeIdFromFile('My-Theme.css')).toBe('My-Theme')
    expect(themeIdToLabel('solarized-light')).toBe('Solarized Light')
    expect(themeIdToLabel('night_owl')).toBe('Night Owl')
  })

  it('detects the editions a theme file provides', () => {
    expect(parseThemeEditions(':root{ --paper: 0 0 0 }')).toEqual({ light: true, dark: false })
    expect(parseThemeEditions(':root{}\n:root.dark{}')).toEqual({ light: true, dark: true })
    expect(parseThemeEditions(':root.dark{ --paper: 0 0 0 }')).toEqual({ light: false, dark: true })
  })

  it('treats the legacy `inkwell: dark` marker as dark-only', () => {
    expect(parseThemeEditions('/* inkwell: dark */\n:root{ --paper: 0 0 0 }')).toEqual({
      light: false,
      dark: true
    })
  })
})
