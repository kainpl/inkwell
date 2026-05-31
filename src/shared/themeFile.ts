/**
 * Pure helpers for external theme files (no electron / DOM), so the main
 * process can validate and parse theme files while the logic stays unit
 * testable. See main/ipc/themes.ts and lib/themeApply.ts for the consumers.
 */

/** A theme file id is a bare filename — reject path separators and traversal. */
export function isValidThemeId(id: string): boolean {
  return id.trim().length > 0 && !/[/\\]/.test(id) && !id.includes('..')
}

/** Whether a directory entry is a selectable theme (a .css, but not *.user.css). */
export function isThemeFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.css') && !lower.endsWith('.user.css')
}

/** Theme id = filename without the `.css` extension. */
export function themeIdFromFile(name: string): string {
  return name.replace(/\.css$/i, '')
}

/** Human label from an id: `my-cool_theme` → `My Cool Theme`. */
export function themeIdToLabel(id: string): string {
  return (
    id
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || id
  )
}

/**
 * Detect which editions a theme file provides. A dual-edition file defines a
 * light edition on `:root { … }` and a dark edition on `:root.dark { … }` (or any
 * `.dark` selector). The legacy `inkwell: dark` marker means a single dark theme
 * (its `:root` is the dark palette).
 */
export function parseThemeEditions(css: string): { light: boolean; dark: boolean } {
  const legacyDark = /inkwell[\s:_-]*dark/i.test(css.slice(0, 500))
  if (legacyDark) {
    return /:root\s*\.dark/.test(css) ? { light: true, dark: true } : { light: false, dark: true }
  }
  const dark = /\.dark\b/.test(css)
  const light = /:root\s*[{,]/.test(css)
  return { light: light || !dark, dark }
}
