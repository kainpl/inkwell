/**
 * Toggleable Markdown features. Each flag gates a feature in BOTH the live
 * editor (livePreview decorations) and export (markdown-it plugins + DOM
 * post-processing). Core CommonMark/GFM (headings, emphasis, lists, tables,
 * task-lists, fenced code) is always on and not represented here.
 */
export interface MarkdownFeatures {
  /** `$…$` / `$$…$$` math (KaTeX). */
  math: boolean
  /** ```mermaid diagrams. */
  mermaid: boolean
  /** `[^id]` footnotes. */
  footnotes: boolean
  /** `~sub~` / `^sup^`. */
  subSup: boolean
  /** `==highlight==`. */
  highlight: boolean
  /** `:shortcode:` emoji. */
  emoji: boolean
  /** `> [!NOTE]` GitHub alerts. */
  alerts: boolean
  /** `[toc]` table of contents. */
  toc: boolean
}

export const DEFAULT_MARKDOWN_FEATURES: MarkdownFeatures = {
  math: true,
  mermaid: true,
  footnotes: true,
  subSup: true,
  highlight: true,
  emoji: true,
  alerts: true,
  toc: true
}

/** Ordered list of features for the Preferences UI. */
export const MARKDOWN_FEATURE_LIST: { key: keyof MarkdownFeatures; label: string }[] = [
  { key: 'math', label: 'Math (KaTeX)' },
  { key: 'mermaid', label: 'Mermaid diagrams' },
  { key: 'footnotes', label: 'Footnotes' },
  { key: 'subSup', label: 'Subscript / superscript' },
  { key: 'highlight', label: 'Highlight (==text==)' },
  { key: 'emoji', label: 'Emoji shortcodes' },
  { key: 'alerts', label: 'Alerts (> [!NOTE])' },
  { key: 'toc', label: 'Table of contents ([toc])' }
]

/** Merge a (possibly partial / stale) stored value onto the defaults. */
export function normalizeFeatures(value: unknown): MarkdownFeatures {
  const out = { ...DEFAULT_MARKDOWN_FEATURES }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(out) as (keyof MarkdownFeatures)[]) {
      const v = (value as Record<string, unknown>)[key]
      if (typeof v === 'boolean') out[key] = v
    }
  }
  return out
}
