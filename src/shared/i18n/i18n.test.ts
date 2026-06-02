import { translate } from './index'
import { en } from './en'
import { uk } from './uk'
import { ru } from './ru'

describe('translate', () => {
  it('returns the string for the locale', () => {
    expect(translate('en', 'file.save')).toBe('Save')
    expect(translate('uk', 'file.save')).toBe('Зберегти')
    expect(translate('ru', 'file.save')).toBe('Сохранить')
  })

  it('falls back to English, then to the key', () => {
    // (no per-locale override case here; unknown key returns itself)
    expect(translate('uk', 'totally.unknown')).toBe('totally.unknown')
  })

  it('interpolates {vars}', () => {
    expect(translate('en', 'status.words', { n: 5 })).toBe('5 words')
    expect(translate('uk', 'status.words', { n: 5 })).toBe('5 слів')
    expect(translate('ru', 'outline.backlinks', { n: 3 })).toBe('Обратные ссылки (3)')
  })
})

describe('locale coverage', () => {
  const enKeys = Object.keys(en).sort()
  it('uk defines exactly the English keys', () => {
    expect(Object.keys(uk).sort()).toEqual(enKeys)
  })
  it('ru defines exactly the English keys', () => {
    expect(Object.keys(ru).sort()).toEqual(enKeys)
  })
})
