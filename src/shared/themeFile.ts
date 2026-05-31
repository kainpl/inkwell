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

/** A theme opts into dark UI chrome with an `inkwell: dark` marker in its head. */
export function parseThemeDark(css: string): boolean {
  return /inkwell[\s:_-]*dark/i.test(css.slice(0, 500))
}
