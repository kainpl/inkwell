import { useAppStore } from '@renderer/store/useAppStore'
import { FONT_STACKS, saveSettings, type Settings } from './settings'

/** Snapshot the Preferences-managed fields from the store. */
function currentSettings(): Settings {
  const s = useAppStore.getState()
  return {
    locale: s.locale,
    theme: s.theme,
    mode: s.mode,
    autoSave: s.autoSave,
    lineEnding: s.lineEnding,
    insertFinalNewline: s.insertFinalNewline,
    formatBarOpen: s.formatBarOpen,
    imageUploadCommand: s.imageUploadCommand,
    editorFont: s.editorFont,
    editorFontSize: s.editorFontSize,
    editorLineHeight: s.editorLineHeight,
    contentWidth: s.contentWidth,
    sidebarWidth: s.sidebarWidth,
    autoHideMenuBar: s.autoHideMenuBar,
    embedImages: s.embedImages,
    exportStyle: s.exportStyle,
    markdownFeatures: s.markdownFeatures,
    wordGoal: s.wordGoal,
    smartPunctuation: s.smartPunctuation,
    spellCheck: s.spellCheck,
    spellLanguages: s.spellLanguages,
    learnedWords: s.learnedWords,
    searchServices: s.searchServices,
    keyBindings: s.keyBindings,
    driveClientId: s.driveClientId,
    driveClientSecret: s.driveClientSecret
  }
}

/** Push the typography settings into CSS variables the editor reads. */
function applyTypography(s: Settings): void {
  const root = document.documentElement.style
  root.setProperty('--ink-editor-font', FONT_STACKS[s.editorFont])
  root.setProperty('--ink-editor-size', `${s.editorFontSize}px`)
  root.setProperty('--ink-editor-leading', String(s.editorLineHeight))
  root.setProperty('--ink-content-width', `${s.contentWidth}%`)
}

/** Push the window-level preferences (menu bar) to the main process. */
function applyWindow(s: Settings): void {
  window.api.setMenuBarAutoHide(s.autoHideMenuBar)
}

/** Push the UI language to the main process so it rebuilds the native menu. */
function applyLocale(s: Settings): void {
  window.api.setLocale(s.locale)
}

/** Push the BYO Drive OAuth credentials to the main process (empty ⇒ built-in). */
function applyDrive(s: Settings): void {
  void window.api.drive.setCredentials(s.driveClientId || null, s.driveClientSecret || null)
}

function equal(a: Settings, b: Settings): boolean {
  return (Object.keys(a) as (keyof Settings)[]).every((k) => a[k] === b[k])
}

/**
 * Apply the typography CSS variables and persist Preferences settings whenever
 * they change. Guarded by a shallow diff so document edits don't trigger writes.
 * Returns an unsubscribe function.
 */
export function startSettingsSync(): () => void {
  let last = currentSettings()
  applyTypography(last)
  applyWindow(last)
  applyLocale(last)
  applyDrive(last)
  return useAppStore.subscribe(() => {
    const cur = currentSettings()
    if (equal(cur, last)) return
    const localeChanged = cur.locale !== last.locale
    last = cur
    applyTypography(cur)
    applyWindow(cur)
    if (localeChanged) applyLocale(cur)
    applyDrive(cur)
    saveSettings(cur)
  })
}
