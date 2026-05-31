import { applyTheme } from './themeApply'
import type { ExternalTheme, ThemeCss } from '@shared/ipc'

const ext: ExternalTheme[] = [
  { id: 'solar', label: 'Solar', dark: false },
  { id: 'mid', label: 'Mid', dark: true }
]

function mockApi(readThemeCss: (id: string) => Promise<ThemeCss>): void {
  ;(window as unknown as { api: unknown }).api = {
    readThemeCss,
    listThemes: async () => ext,
    onThemesChanged: () => () => undefined
  }
}

beforeEach(() => {
  document.getElementById('ink-theme-css')?.remove()
  document.getElementById('ink-user-css')?.remove()
  document.documentElement.className = ''
  delete document.documentElement.dataset.theme
})

describe('applyTheme', () => {
  it('injects external theme CSS + user cascade and sets data-theme/.dark', async () => {
    mockApi(async () => ({ theme: 'THEME_CSS', base: 'BASE_CSS', themeUser: 'USER_CSS' }))
    await applyTheme('mid', ext)
    expect(document.documentElement.dataset.theme).toBe('mid')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.getElementById('ink-theme-css')?.textContent).toContain('THEME_CSS')
    const user = document.getElementById('ink-user-css')?.textContent ?? ''
    expect(user).toContain('BASE_CSS')
    expect(user).toContain('USER_CSS')
  })

  it('injects no theme file for a built-in but still cascades base.user.css', async () => {
    mockApi(async () => ({ theme: null, base: 'BASE_CSS', themeUser: null }))
    await applyTheme('light', ext)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.getElementById('ink-theme-css')).toBeNull()
    expect(document.getElementById('ink-user-css')?.textContent).toContain('BASE_CSS')
  })

  it('keeps the latest apply when results arrive out of order', async () => {
    const resolvers: ((v: ThemeCss) => void)[] = []
    mockApi(() => new Promise((res) => resolvers.push(res)))
    const p1 = applyTheme('solar', ext)
    const p2 = applyTheme('mid', ext)
    // Resolve the SECOND (newest) call first, then the stale first call.
    resolvers[1]({ theme: 'SECOND', base: null, themeUser: null })
    resolvers[0]({ theme: 'FIRST', base: null, themeUser: null })
    await Promise.all([p1, p2])
    expect(document.documentElement.dataset.theme).toBe('mid')
    expect(document.getElementById('ink-theme-css')?.textContent).toBe('SECOND')
  })
})
