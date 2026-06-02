/**
 * User preferences persisted to localStorage. Pure (no DOM) so it can be unit
 * tested; the store seeds its fields from here and `settingsSync` writes/applies
 * them. Only Preferences-managed fields live here — document/session state does not.
 */

import { migrateTheme } from './themes'
import {
  type MarkdownFeatures,
  DEFAULT_MARKDOWN_FEATURES,
  normalizeFeatures
} from './markdownFeatures'
import { type Locale, DEFAULT_LOCALE, isLocale } from '@shared/i18n'

export type EditorFont = 'serif' | 'sans' | 'mono' | 'jetbrains'

/** Allowed pixel range for the resizable side panels (sidebar / outline). */
export const PANEL_MIN = 160
export const PANEL_MAX = 520

export interface Settings {
  /** UI language for chrome + native menu (see shared/i18n). */
  locale: Locale
  /** Built-in theme id (see lib/themes.ts). */
  theme: string
  /** Active edition of the theme. */
  mode: 'light' | 'dark'
  autoSave: boolean
  lineEnding: 'lf' | 'crlf'
  insertFinalNewline: boolean
  formatBarOpen: boolean
  imageUploadCommand: string
  editorFont: EditorFont
  editorFontSize: number
  editorLineHeight: number
  /** Width of the centred writing column, as a percentage of the editor width. */
  contentWidth: number
  /** Width of the left sidebar, in pixels. */
  sidebarWidth: number
  /** Auto-hide the native menu bar (Windows/Linux; press Alt to reveal). */
  autoHideMenuBar: boolean
  /** Embed local images as data: URIs in exported HTML. */
  embedImages: boolean
  /** Export CSS: the built-in print stylesheet, or the active editor theme. */
  exportStyle: 'default' | 'theme'
  /** Toggleable Markdown features (live editor + export). */
  markdownFeatures: MarkdownFeatures
  /** Convert straight quotes/dashes/ellipsis to typographic ones as you type. */
  smartPunctuation: boolean
  /** Spell check (underline misspellings, right-click suggestions). */
  spellCheck: boolean
  /** Active spell-check languages (bundled `en`, others downloaded on demand). */
  spellLanguages: string[]
  /** Words the user added to their dictionary. */
  learnedWords: string[]
  /** "Search With…" context-menu services (`%s` is the query). */
  searchServices: { name: string; url: string }[]
  /** Custom keyboard shortcuts: command id → CodeMirror key (e.g. `Mod-Shift-k`). */
  keyBindings: Record<string, string>
  /** BYO Google OAuth client id (empty ⇒ use the built-in one). */
  driveClientId: string
  /** BYO Google OAuth client secret (pairs with driveClientId). */
  driveClientSecret: string
}

export const FONT_STACKS: Record<EditorFont, string> = {
  serif: 'ui-serif, "Iowan Old Style", Charter, Palatino, Georgia, serif',
  sans: 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  jetbrains: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
}

export const DEFAULT_SETTINGS: Settings = {
  locale: DEFAULT_LOCALE,
  theme: 'inkwell',
  mode: 'light',
  autoSave: false,
  lineEnding: 'lf',
  insertFinalNewline: true,
  formatBarOpen: true,
  imageUploadCommand: '',
  editorFont: 'serif',
  editorFontSize: 17,
  editorLineHeight: 1.75,
  contentWidth: 80,
  sidebarWidth: 240,
  autoHideMenuBar: false,
  embedImages: true,
  exportStyle: 'default',
  markdownFeatures: DEFAULT_MARKDOWN_FEATURES,
  smartPunctuation: false,
  spellCheck: false,
  spellLanguages: ['en'],
  learnedWords: [],
  searchServices: [
    { name: 'Google', url: 'https://www.google.com/search?q=%s' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
    { name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=%s' }
  ],
  keyBindings: {},
  driveClientId: '',
  driveClientSecret: ''
}

const KEY = 'inkwell.settings'

/** Clamp numeric fields to sane ranges (also migrates legacy values, e.g. a
 *  content width once stored in pixels falls outside the % range → default). */
/** Active spell languages, migrating the legacy single `spellLanguage` string. */
function normalizeSpellLanguages(s: Settings): string[] {
  if (Array.isArray(s.spellLanguages) && s.spellLanguages.length) return s.spellLanguages
  const legacy = (s as unknown as { spellLanguage?: unknown }).spellLanguage
  return typeof legacy === 'string' ? [legacy] : ['en']
}

function sanitize(s: Settings): Settings {
  const clamp = (n: number, lo: number, hi: number, dflt: number): number =>
    Number.isFinite(n) && n >= lo && n <= hi ? n : dflt
  const migrated = migrateTheme(s.theme, s.mode)
  return {
    ...s,
    locale: isLocale(s.locale) ? s.locale : DEFAULT_LOCALE,
    theme: migrated.theme,
    mode: migrated.mode,
    exportStyle: s.exportStyle === 'theme' ? 'theme' : 'default',
    markdownFeatures: normalizeFeatures(s.markdownFeatures),
    learnedWords: Array.isArray(s.learnedWords) ? s.learnedWords : [],
    spellLanguages: normalizeSpellLanguages(s),
    searchServices: Array.isArray(s.searchServices) ? s.searchServices : DEFAULT_SETTINGS.searchServices,
    keyBindings: s.keyBindings && typeof s.keyBindings === 'object' ? s.keyBindings : {},
    editorFontSize: clamp(s.editorFontSize, 10, 40, DEFAULT_SETTINGS.editorFontSize),
    editorLineHeight: clamp(s.editorLineHeight, 1, 3, DEFAULT_SETTINGS.editorLineHeight),
    contentWidth: clamp(s.contentWidth, 40, 100, DEFAULT_SETTINGS.contentWidth),
    sidebarWidth: clamp(s.sidebarWidth, PANEL_MIN, PANEL_MAX, DEFAULT_SETTINGS.sidebarWidth),
    driveClientId: typeof s.driveClientId === 'string' ? s.driveClientId : '',
    driveClientSecret: typeof s.driveClientSecret === 'string' ? s.driveClientSecret : ''
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    return sanitize({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) })
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable — non-fatal */
  }
}
