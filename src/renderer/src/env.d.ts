/// <reference types="vite/client" />

// emojilib ships no types. Its default export wraps the data under `lib`,
// keyed by shortcode name -> { char, keywords, category, ... }.
declare module 'emojilib' {
  interface EmojiLibEntry {
    char: string
    keywords: string[]
    category?: string
    fitzpatrick_scale?: boolean
  }
  const emojilib: { lib: Record<string, EmojiLibEntry> }
  export default emojilib
}
