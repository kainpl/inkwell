import { DEFAULT_SETTINGS, FONT_STACKS, loadSettings, saveSettings } from './settings'

beforeEach(() => localStorage.clear())

describe('settings persistence', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges a stored partial onto the defaults', () => {
    saveSettings({ ...DEFAULT_SETTINGS, editorFont: 'serif', contentWidth: 600 })
    const s = loadSettings()
    expect(s.editorFont).toBe('serif')
    expect(s.contentWidth).toBe(600)
    expect(s.editorLineHeight).toBe(DEFAULT_SETTINGS.editorLineHeight)
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('inkwell.settings', '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('has a font stack for every font choice', () => {
    expect(Object.keys(FONT_STACKS)).toEqual(['serif', 'sans', 'mono'])
  })
})
