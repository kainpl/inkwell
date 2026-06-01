import { DEFAULT_SETTINGS, FONT_STACKS, loadSettings, saveSettings } from './settings'

beforeEach(() => localStorage.clear())

describe('settings persistence', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges a stored partial onto the defaults', () => {
    saveSettings({ ...DEFAULT_SETTINGS, editorFont: 'serif', contentWidth: 70 })
    const s = loadSettings()
    expect(s.editorFont).toBe('serif')
    expect(s.contentWidth).toBe(70)
    expect(s.editorLineHeight).toBe(DEFAULT_SETTINGS.editorLineHeight)
  })

  it('migrates an out-of-range content width (legacy pixels) back to the default', () => {
    saveSettings({ ...DEFAULT_SETTINGS, contentWidth: 736 })
    expect(loadSettings().contentWidth).toBe(DEFAULT_SETTINGS.contentWidth)
  })

  it('clamps an out-of-range sidebar width back to the default', () => {
    saveSettings({ ...DEFAULT_SETTINGS, sidebarWidth: 9000 })
    expect(loadSettings().sidebarWidth).toBe(DEFAULT_SETTINGS.sidebarWidth)
  })

  it('keeps an in-range sidebar width', () => {
    saveSettings({ ...DEFAULT_SETTINGS, sidebarWidth: 300 })
    expect(loadSettings().sidebarWidth).toBe(300)
  })

  it('clamps a corrupt font size to the default', () => {
    saveSettings({ ...DEFAULT_SETTINGS, editorFontSize: 0 })
    expect(loadSettings().editorFontSize).toBe(DEFAULT_SETTINGS.editorFontSize)
  })

  it('migrates an unknown theme id back to the default', () => {
    saveSettings({ ...DEFAULT_SETTINGS, theme: 'bogus' })
    expect(loadSettings().theme).toBe(DEFAULT_SETTINGS.theme)
  })

  it('keeps a known built-in theme id', () => {
    saveSettings({ ...DEFAULT_SETTINGS, theme: 'github' })
    expect(loadSettings().theme).toBe('github')
  })

  it('migrates a legacy theme id to a theme + mode', () => {
    saveSettings({ ...DEFAULT_SETTINGS, theme: 'night' })
    const s = loadSettings()
    expect(s.theme).toBe('tokyo')
    expect(s.mode).toBe('dark')
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('inkwell.settings', '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('has a font stack for every font choice', () => {
    expect(Object.keys(FONT_STACKS)).toEqual(['serif', 'sans', 'mono', 'jetbrains'])
  })
})
