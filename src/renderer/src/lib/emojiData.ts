import emojilib from 'emojilib'

/**
 * The complete emoji set (from emojilib, node-emoji's data dependency), flattened
 * for the picker. `emojilib.lib` is keyed by shortcode name; each value carries
 * the glyph (`char`), `keywords`, and a `category`. ~1570 valid entries.
 */
export interface EmojiEntry {
  emoji: string
  /** Shortcode name, shown as the button tooltip and used for search. */
  name: string
  keywords: string[]
  category: string
}

// Category ids match emojilib's `category` field exactly.
/** Display order + labels for the picker's category tabs. */
export const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'people', label: 'Smileys & People', icon: '😀' },
  { id: 'animals_and_nature', label: 'Animals & Nature', icon: '🐻' },
  { id: 'food_and_drink', label: 'Food & Drink', icon: '🍔' },
  { id: 'activity', label: 'Activity', icon: '⚽' },
  { id: 'travel_and_places', label: 'Travel & Places', icon: '✈️' },
  { id: 'objects', label: 'Objects', icon: '💡' },
  { id: 'symbols', label: 'Symbols', icon: '❤️' },
  { id: 'flags', label: 'Flags', icon: '🚩' },
  { id: 'other', label: 'Other', icon: '🔣' }
]

export const ALL_EMOJI: EmojiEntry[] = Object.entries(emojilib.lib)
  // Drop the data file's stray header row (no glyph).
  .filter(([, e]) => typeof e.char === 'string' && e.char.length > 0)
  .map(([name, e]) => ({
    emoji: e.char,
    name,
    keywords: [name, ...(e.keywords ?? [])],
    category: e.category ?? 'other'
  }))

/** Emoji grouped by category id, in `CATEGORIES` order. */
export const BY_CATEGORY: Record<string, EmojiEntry[]> = ALL_EMOJI.reduce(
  (acc, e) => {
    const id = CATEGORIES.some((c) => c.id === e.category) ? e.category : 'other'
    ;(acc[id] ??= []).push(e)
    return acc
  },
  {} as Record<string, EmojiEntry[]>
)

/** Case-insensitive keyword filter; empty query returns the full set. */
export function filterEmoji(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return ALL_EMOJI
  return ALL_EMOJI.filter((e) => e.keywords.some((k) => k.includes(q)))
}
