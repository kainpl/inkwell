/**
 * User preferences persisted to localStorage. Pure (no DOM) so it can be unit
 * tested; the store seeds its fields from here and `settingsSync` writes/applies
 * them. Only Preferences-managed fields live here — document/session state does not.
 */

export type EditorFont = 'serif' | 'sans' | 'mono'

export interface Settings {
  theme: 'light' | 'dark'
  autoSave: boolean
  lineEnding: 'lf' | 'crlf'
  insertFinalNewline: boolean
  formatBarOpen: boolean
  imageUploadCommand: string
  editorFont: EditorFont
  editorFontSize: number
  editorLineHeight: number
  contentWidth: number
  /** Embed local images as data: URIs in exported HTML. */
  embedImages: boolean
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
  contentWidth: 736,
  embedImages: true
}

const KEY = 'inkwell.settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS
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
