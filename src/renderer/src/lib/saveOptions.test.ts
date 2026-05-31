import { detectLineEnding, normalizeForSave } from './saveOptions'

describe('detectLineEnding', () => {
  it('detects crlf vs lf', () => {
    expect(detectLineEnding('a\r\nb')).toBe('crlf')
    expect(detectLineEnding('a\nb')).toBe('lf')
    expect(detectLineEnding('no newlines')).toBe('lf')
  })
})

describe('normalizeForSave', () => {
  it('converts to LF and adds a final newline', () => {
    expect(normalizeForSave('a\r\nb', { lineEnding: 'lf', insertFinalNewline: true })).toBe('a\nb\n')
  })

  it('converts to CRLF', () => {
    expect(normalizeForSave('a\nb', { lineEnding: 'crlf', insertFinalNewline: true })).toBe(
      'a\r\nb\r\n'
    )
  })

  it('collapses multiple trailing newlines to exactly one', () => {
    expect(normalizeForSave('a\n\n\n', { lineEnding: 'lf', insertFinalNewline: true })).toBe('a\n')
  })

  it('leaves trailing newlines alone when the option is off', () => {
    expect(normalizeForSave('a\nb', { lineEnding: 'lf', insertFinalNewline: false })).toBe('a\nb')
  })

  it('does not double-convert mixed endings', () => {
    expect(normalizeForSave('a\r\nb\nc', { lineEnding: 'crlf', insertFinalNewline: false })).toBe(
      'a\r\nb\r\nc'
    )
  })
})
