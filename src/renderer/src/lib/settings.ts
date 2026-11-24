import { DEFAULT_MARKDOWN_FEATURES, normalizeFeatures } from './markdownFeatures'
import { commands, defaultShortcuts, parseShortcut } from './shortcuts'

export const palettes = ['Inkwell', 'GitHub', 'Newsprint', 'Pixyll', 'Tokyo'] as const
export const fonts = {
  Serif: 'Georgia, serif',
  Sans: 'Arial, sans-serif',
  System: 'system-ui, sans-serif',
  Monospace: 'ui-monospace, Consolas, monospace',
  'JetBrains Mono': '"JetBrains Mono Variable", monospace'
}
export type Language = 'uk' | 'en'
export const editorModes = ['live', 'visual', 'source'] as const
export type EditorMode = (typeof editorModes)[number]
export const editorModeLabels: Record<EditorMode, string> = {
  live: 'Live Markdown',
  visual: 'Visual editing',
  source: 'Source'
}
export const sidebarMinWidth = 180
export const sidebarMaxWidth = 720
const language: Language = navigator.language.toLowerCase().startsWith('uk') ? 'uk' : 'en'
export const defaults = {
  language,
  theme: 'dark' as 'light' | 'dark',
  palette: 'Inkwell' as (typeof palettes)[number],
  font: 'JetBrains Mono' as keyof typeof fonts,
  fontSize: 12,
  lineHeight: 1.25,
  columnWidth: 90,
  sidebarWidth: 240,
  editorMode: 'visual' as EditorMode,
  lastFormattedMode: 'visual' as Exclude<EditorMode, 'source'>,
  focusMode: false,
  typewriterMode: false,
  autoSave: false,
  lineEnding: 'LF' as 'LF' | 'CRLF',
  finalNewline: false,
  smartPunctuation: false,
  features: DEFAULT_MARKDOWN_FEATURES,
  shortcuts: defaultShortcuts,
  spellCheck: false,
  spellLanguages: [language] as Language[],
  personalWords: [] as string[],
  wordGoals: {} as Record<string, number>
}
export type Settings = typeof defaults
export const settingsKey = 'inkwell.preferences.v1'
export const settingsKeys = Object.keys(defaults) as (keyof Settings)[]

export function readSettings(): Settings {
  const out = { ...defaults }
  try {
    const s = JSON.parse(localStorage.getItem(settingsKey) || '{}')
    for (const key of [
      'focusMode',
      'typewriterMode',
      'autoSave',
      'finalNewline',
      'smartPunctuation',
      'spellCheck'
    ] as const)
      if (typeof s[key] === 'boolean') out[key] = s[key]
    if (editorModes.includes(s.editorMode)) out.editorMode = s.editorMode
    else if (s.sourceMode === true) out.editorMode = 'source'
    if (out.editorMode !== 'source') out.lastFormattedMode = out.editorMode
    else if (s.lastFormattedMode === 'live' || s.lastFormattedMode === 'visual')
      out.lastFormattedMode = s.lastFormattedMode
    for (const [key, min, max] of [
      ['fontSize', 11, 24],
      ['lineHeight', 1, 2.4],
      ['columnWidth', 40, 100],
      ['sidebarWidth', sidebarMinWidth, sidebarMaxWidth]
    ] as const)
      if (Number.isFinite(s[key])) out[key] = Math.max(min, Math.min(max, s[key]))
    if (s.language === 'uk' || s.language === 'en') out.language = s.language
    if (s.theme === 'light' || s.theme === 'dark') out.theme = s.theme
    if (s.lineEnding === 'CRLF') out.lineEnding = 'CRLF'
    if (palettes.includes(s.palette)) out.palette = s.palette
    if (Object.hasOwn(fonts, s.font)) out.font = s.font
    out.features = normalizeFeatures(s.features)
    out.shortcuts = { ...defaultShortcuts }
    for (const cmd of commands) {
      const value = s.shortcuts?.[cmd]
      if (typeof value === 'string')
        out.shortcuts[cmd] = parseShortcut(value) ?? defaultShortcuts[cmd]
    }
    if (Array.isArray(s.personalWords))
      out.personalWords = s.personalWords.filter((v: unknown) => typeof v === 'string')
    if (Array.isArray(s.spellLanguages)) {
      const langs = s.spellLanguages.filter((v: unknown) => v === 'en' || v === 'uk')
      if (langs.length) out.spellLanguages = langs
    }
    out.wordGoals = Object.fromEntries(
      Object.entries(s.wordGoals ?? {}).filter(
        ([, v]) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
      )
    ) as Record<string, number>
  } catch {
    /* A damaged or unavailable preference store starts with defaults. */
  }
  return out
}
