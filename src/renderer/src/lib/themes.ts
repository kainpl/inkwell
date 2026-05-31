/**
 * Built-in theme registry. A theme is just a palette of CSS variables (defined
 * in index.css under `[data-theme="…"]`); this file is the single source of
 * truth for which themes exist, their labels, and whether they are dark-based.
 * Pure data (no DOM) so it can be imported anywhere, including settings.
 */

export interface ThemeDef {
  id: string
  label: string
  /** Dark-based theme: toggles the `.dark` class for component-level styling. */
  dark: boolean
}

export const THEMES: ThemeDef[] = [
  { id: 'light', label: 'Light', dark: false },
  { id: 'dark', label: 'Dark', dark: true },
  { id: 'github', label: 'GitHub', dark: false },
  { id: 'newsprint', label: 'Newsprint', dark: false },
  { id: 'night', label: 'Night', dark: true },
  { id: 'pixyll', label: 'Pixyll', dark: false }
]

/** Whether a theme id is dark-based (drives the `.dark` class). Unknown → false. */
export function isDarkTheme(id: string): boolean {
  return THEMES.find((t) => t.id === id)?.dark ?? false
}

/** Whether a theme id is a known built-in (used to migrate stale settings). */
export function isKnownTheme(id: string): boolean {
  return THEMES.some((t) => t.id === id)
}

/**
 * Resolve dark-ness across built-in and external themes: built-ins win, then the
 * external list (from the themes folder). Unknown → false.
 */
export function isDarkThemeResolved(
  id: string,
  external: { id: string; dark: boolean }[] = []
): boolean {
  const builtIn = THEMES.find((t) => t.id === id)
  if (builtIn) return builtIn.dark
  return external.find((t) => t.id === id)?.dark ?? false
}
