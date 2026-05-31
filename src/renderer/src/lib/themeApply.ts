import type { ExternalTheme } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { type Mode, clampMode } from './themes'

/**
 * Applies the active theme to the document and keeps the external-theme list in
 * sync with the user's themes folder. A built-in theme is just a `[data-theme]`
 * palette in index.css; an external theme additionally injects its CSS file plus
 * the `base.user.css` / `{id}.user.css` override cascade. This module owns ALL
 * theme application (App.tsx no longer toggles `data-theme`/`.dark` itself).
 */

/** Set (or remove, when empty) a singleton <style> in <head> by id. */
function setStyle(elId: string, css: string): void {
  let el = document.getElementById(elId) as HTMLStyleElement | null
  if (!css) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = elId
    document.head.appendChild(el)
  }
  el.textContent = css
}

// Latest-wins guard: a slow CSS fetch must not clobber a newer theme switch.
let applyToken = 0

/**
 * Apply a theme id: set `data-theme` + `.dark` synchronously (no flash), then
 * inject the external theme CSS and the user-override cascade (guarded so a
 * stale async result can't overwrite a newer apply).
 */
export async function applyTheme(id: string, mode: Mode, external: ExternalTheme[]): Promise<void> {
  const token = ++applyToken
  const isExternal = external.some((t) => t.id === id)

  const root = document.documentElement
  root.dataset.theme = id
  root.classList.toggle('dark', clampMode(id, mode, external) === 'dark')

  const { theme, base, themeUser } = await window.api.readThemeCss(id)
  if (token !== applyToken) return // a newer applyTheme started; drop this result

  setStyle('ink-theme-css', isExternal ? (theme ?? '') : '')
  setStyle('ink-user-css', [base, themeUser].filter(Boolean).join('\n\n'))
}

/**
 * Discover external themes, apply the current theme, and keep both in sync:
 * re-apply on theme change and refresh + re-apply when the themes folder changes.
 * Returns an unsubscribe function.
 */
export function startThemeSync(): () => void {
  const store = useAppStore.getState()

  const refresh = async (): Promise<void> => {
    const list = await window.api.listThemes().catch(() => [])
    useAppStore.getState().setExternalThemes(list)
    const s = useAppStore.getState()
    await applyTheme(s.theme, s.mode, list)
  }

  // Apply immediately (built-in palette needs no IPC → avoids a flash), then
  // discover external themes and re-apply in case the active one is external.
  void applyTheme(store.theme, store.mode, store.externalThemes)
  void refresh()

  let lastTheme = store.theme
  let lastMode = store.mode
  const unsub = useAppStore.subscribe(() => {
    const s = useAppStore.getState()
    if (s.theme !== lastTheme || s.mode !== lastMode) {
      lastTheme = s.theme
      lastMode = s.mode
      void applyTheme(s.theme, s.mode, s.externalThemes)
    }
  })
  const offChanged = window.api.onThemesChanged(() => void refresh())

  return () => {
    unsub()
    offChanged()
  }
}
