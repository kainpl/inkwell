import { keyComboToCM } from './customKeymap'

const ev = (over: Partial<Parameters<typeof keyComboToCM>[0]>): Parameters<typeof keyComboToCM>[0] => ({
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  key: '',
  ...over
})

describe('keyComboToCM', () => {
  it('uses Mod for ctrl/meta and lowercases letters', () => {
    expect(keyComboToCM(ev({ ctrlKey: true, key: 'B' }))).toBe('Mod-b')
    expect(keyComboToCM(ev({ metaKey: true, key: 'b' }))).toBe('Mod-b')
  })

  it('combines modifiers (Mod, Alt, Shift) in order', () => {
    expect(keyComboToCM(ev({ ctrlKey: true, shiftKey: true, key: 'K' }))).toBe('Mod-Shift-k')
    expect(keyComboToCM(ev({ altKey: true, key: 'ArrowUp' }))).toBe('Alt-ArrowUp')
  })

  it('returns null for a modifier-only press or Escape', () => {
    expect(keyComboToCM(ev({ key: 'Shift', shiftKey: true }))).toBeNull()
    expect(keyComboToCM(ev({ key: 'Escape' }))).toBeNull()
  })
})
