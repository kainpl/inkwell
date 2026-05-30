import { ALL_EMOJI, BY_CATEGORY, CATEGORIES, filterEmoji } from './emojiData'

describe('emojiData', () => {
  it('exposes the full emoji set', () => {
    expect(ALL_EMOJI.length).toBeGreaterThan(1000)
    expect(ALL_EMOJI[0]).toHaveProperty('emoji')
    expect(ALL_EMOJI[0]).toHaveProperty('keywords')
  })

  it('returns everything for an empty query', () => {
    expect(filterEmoji('')).toHaveLength(ALL_EMOJI.length)
  })

  it('filters by keyword', () => {
    const r = filterEmoji('rocket')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((e) => e.keywords.some((k) => k.includes('rocket')))).toBe(true)
  })

  it('returns nothing for nonsense', () => {
    expect(filterEmoji('zzzznotanemoji')).toHaveLength(0)
  })

  it('drops entries without a glyph (the data file header row)', () => {
    expect(ALL_EMOJI.every((e) => e.emoji.length > 0)).toBe(true)
  })

  it('groups every emoji into a known category, none lost', () => {
    const grouped = CATEGORIES.reduce((n, c) => n + (BY_CATEGORY[c.id]?.length ?? 0), 0)
    expect(grouped).toBe(ALL_EMOJI.length)
  })

  it('leaves the "other" bucket empty — every tab id matches real data', () => {
    // Guards the bug where tab ids (nature/food/travel) didn't match emojilib's
    // animals_and_nature/food_and_drink/travel_and_places, leaving tabs blank.
    expect((BY_CATEGORY['other'] ?? []).length).toBe(0)
  })

  it('populates each visible category tab', () => {
    for (const c of CATEGORIES) {
      if (c.id === 'other') continue
      expect((BY_CATEGORY[c.id] ?? []).length, `category ${c.id}`).toBeGreaterThan(0)
    }
  })
})
