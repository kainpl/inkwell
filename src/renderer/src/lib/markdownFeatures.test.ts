import {
  DEFAULT_MARKDOWN_FEATURES,
  MARKDOWN_FEATURE_LIST,
  normalizeFeatures
} from './markdownFeatures'

describe('markdownFeatures', () => {
  it('defaults every feature on', () => {
    expect(Object.values(DEFAULT_MARKDOWN_FEATURES).every((v) => v === true)).toBe(true)
  })

  it('merges a partial value onto the defaults and drops unknown keys', () => {
    const f = normalizeFeatures({ math: false, bogus: true })
    expect(f.math).toBe(false)
    expect(f.emoji).toBe(true) // missing → default on
    expect('bogus' in f).toBe(false)
  })

  it('ignores non-boolean values', () => {
    const f = normalizeFeatures({ math: 'no' as unknown })
    expect(f.math).toBe(true)
  })

  it('falls back to all-on for non-objects', () => {
    expect(normalizeFeatures(null)).toEqual(DEFAULT_MARKDOWN_FEATURES)
    expect(normalizeFeatures('x')).toEqual(DEFAULT_MARKDOWN_FEATURES)
  })

  it('the UI list covers exactly every feature key', () => {
    const listed = MARKDOWN_FEATURE_LIST.map((f) => f.key).sort()
    expect(listed).toEqual(Object.keys(DEFAULT_MARKDOWN_FEATURES).sort())
  })
})
