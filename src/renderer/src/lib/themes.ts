/**
 * Built-in theme registry. A theme is an umbrella with up to two editions —
 * light and dark (palettes of CSS variables in index.css under `[data-theme]`
 * and `[data-theme].dark`). A separate `mode` selects the active edition. Pure
 * data (no DOM) so it can be imported anywhere, including settings.
 */

export type Mode = 'light' | 'dark'

export interface ThemeDef {
  id: string
  label: string
  /** Has a light edition. */
  light: boolean
  /** Has a dark edition. */
  dark: boolean
}

export const THEMES: ThemeDef[] = [
  { id: 'inkwell', label: 'Inkwell', light: true, dark: true },
  { id: 'github', label: 'GitHub', light: true, dark: true },
  { id: 'newsprint', label: 'Newsprint', light: true, dark: true },
  { id: 'pixyll', label: 'Pixyll', light: true, dark: true },
  { id: 'tokyo', label: 'Tokyo', light: true, dark: true }
]

/** Whether a theme id is a known built-in (used to migrate stale settings). */
export function isKnownTheme(id: string): boolean {
  return THEMES.some((t) => t.id === id)
}

/** Minimal shape carrying a theme's editions (built-in or external). */
export interface Editions {
  light: boolean
  dark: boolean
}

type EditionSource = readonly (Editions & { id: string })[]

/**
 * The editions available for a theme id: built-ins win, then the external list
 * (from the themes folder). Unknown ids report light-only.
 */
export function themeEditions(id: string, external: EditionSource = []): Editions {
  const builtIn = THEMES.find((t) => t.id === id)
  if (builtIn) return { light: builtIn.light, dark: builtIn.dark }
  const ext = external.find((t) => t.id === id)
  if (ext) return { light: ext.light, dark: ext.dark }
  return { light: true, dark: false }
}

/**
 * Clamp a requested mode to what the theme actually provides: the requested mode
 * if available, otherwise the other edition, otherwise light.
 */
export function clampMode(id: string, mode: Mode, external: EditionSource = []): Mode {
  const ed = themeEditions(id, external)
  if (mode === 'dark') return ed.dark ? 'dark' : 'light'
  return ed.light ? 'light' : 'dark'
}

/** Whether the theme can switch editions (both light and dark exist). */
export function hasBothEditions(id: string, external: EditionSource = []): boolean {
  const ed = themeEditions(id, external)
  return ed.light && ed.dark
}

/**
 * Migrate a stored (theme, mode) pair: the old standalone Light/Dark/Night ids
 * fold into the new editions model. Unknown ids reset to the default.
 */
export function migrateTheme(theme: string, mode: Mode): { theme: string; mode: Mode } {
  const legacy: Record<string, { theme: string; mode: Mode }> = {
    light: { theme: 'inkwell', mode: 'light' },
    dark: { theme: 'inkwell', mode: 'dark' },
    night: { theme: 'tokyo', mode: 'dark' }
  }
  if (theme in legacy) return legacy[theme]
  if (isKnownTheme(theme)) return { theme, mode: mode === 'dark' ? 'dark' : 'light' }
  return { theme: 'inkwell', mode: 'light' }
}
