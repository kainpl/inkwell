import { ENCODINGS, isEncoding, decode } from './encodings'

describe('encodings', () => {
  it('recognises offered ids and rejects others', () => {
    expect(isEncoding('windows-1251')).toBe(true)
    expect(isEncoding('utf-8')).toBe(true)
    expect(isEncoding('rot13')).toBe(false)
  })

  it('UTF-8 is the first (default) option', () => {
    expect(ENCODINGS[0].id).toBe('utf-8')
  })

  it('decodes windows-1251 Cyrillic bytes', () => {
    // "Привіт" in Windows-1251.
    const bytes = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xb3, 0xf2])
    expect(decode(bytes, 'windows-1251')).toBe('Привіт')
  })

  it('the same bytes read as UTF-8 are NOT the Cyrillic text (mojibake)', () => {
    const bytes = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xb3, 0xf2])
    expect(decode(bytes, 'utf-8')).not.toBe('Привіт')
  })

  it('falls back to UTF-8 for an unknown encoding id', () => {
    const bytes = new TextEncoder().encode('hello')
    expect(decode(bytes, 'bogus-encoding')).toBe('hello')
  })
})
