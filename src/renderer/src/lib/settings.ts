/**
 * User preferences persisted to localStorage. Pure (no DOM) so it can be unit
 * tested; the store seeds its fields from here and `settingsSync` writes/applies
 * them. Only Preferences-managed fields live here — document/session state does not.
 */

import { isKnownTheme } from './themes'
import {
  type MarkdownFeatures,
  DEFAULT_MARKDOWN_FEATURES,
  normalizeFeatures
} from './markdownFeatures'

export type EditorFont = 'serif' | 'sans' | 'mono'

export interface Settings {
  /** Built-in theme id (see lib/themes.ts). */
  theme: string
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
  /** Auto-hide the native menu bar (Windows/Linux; press Alt to reveal). */
  autoHideMenuBar: boolean
  /** Embed local images as data: URIs in exported HTML. */
  embedImages: boolean
  /** Export CSS: the built-in print stylesheet, or the active editor theme. */
  exportStyle: 'default' | 'theme'
  /** Toggleable Markdown features (live editor + export). */
  markdownFeatures: MarkdownFeatures
}

export const FONT_STACKS: Record<EditorFont, string> = {
  serif: 'ui-serif, "Iowan Old Style", Charter, Palatino, Georgia, serif',
  sans: 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace'
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  autoSave: false,
  lineEnding: 'lf',
  insertFinalNewline: true,
  formatBarOpen: true,
  imageUploadCommand: '',
  editorFont: 'serif',
  editorFontSize: 17,
  editorLineHeight: 1.75,
  contentWidth: 80,
  autoHideMenuBar: false,
  embedImages: true,
  exportStyle: 'default',
  markdownFeatures: DEFAULT_MARKDOWN_FEATURES
}

const KEY = 'inkwell.settings'

/** Clamp numeric fields to sane ranges (also migrates legacy values, e.g. a
 *  content width once stored in pixels falls outside the % range → default). */
function sanitize(s: Settings): Settings {
  const clamp = (n: number, lo: number, hi: number, dflt: number): number =>
    Number.isFinite(n) && n >= lo && n <= hi ? n : dflt
  return {
    ...s,
    theme: isKnownTheme(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    exportStyle: s.exportStyle === 'theme' ? 'theme' : 'default',
    markdownFeatures: normalizeFeatures(s.markdownFeatures),
    editorFontSize: clamp(s.editorFontSize, 10, 40, DEFAULT_SETTINGS.editorFontSize),
    editorLineHeight: clamp(s.editorLineHeight, 1, 3, DEFAULT_SETTINGS.editorLineHeight),
    contentWidth: clamp(s.contentWidth, 40, 100, DEFAULT_SETTINGS.contentWidth)
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
