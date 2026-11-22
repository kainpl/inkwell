import { readSettings, settingsKey } from './settings'

afterEach(() => localStorage.removeItem(settingsKey))

it('uses the default appearance for a fresh profile', () => {
  expect(readSettings()).toMatchObject({
    theme: 'dark',
    palette: 'Inkwell',
    font: 'JetBrains Mono',
    fontSize: 12,
    lineHeight: 1.25,
    columnWidth: 90
  })
})

it('restores a saved light theme and language alongside defaults for missing settings', () => {
  localStorage.setItem(settingsKey, JSON.stringify({ theme: 'light', language: 'uk', fontSize: 18 }))
  expect(readSettings()).toMatchObject({ theme: 'light', language: 'uk', fontSize: 18, columnWidth: 90 })
})
