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

it('defaults to visual editing for new and legacy profiles without a chosen mode', () => {
  expect(readSettings().editorMode).toBe('visual')
  localStorage.setItem(settingsKey, JSON.stringify({ sourceMode: false }))
  expect(readSettings().editorMode).toBe('visual')
})

it('restores a saved light theme and language alongside defaults for missing settings', () => {
  localStorage.setItem(settingsKey, JSON.stringify({ theme: 'light', language: 'uk', fontSize: 18 }))
  expect(readSettings()).toMatchObject({ theme: 'light', language: 'uk', fontSize: 18, columnWidth: 90 })
})

it('restores the selected mode and migrates the previous source toggle', () => {
  localStorage.setItem(settingsKey, JSON.stringify({ sourceMode: true }))
  expect(readSettings().editorMode).toBe('source')
  localStorage.setItem(settingsKey, JSON.stringify({ editorMode: 'visual' }))
  expect(readSettings().editorMode).toBe('visual')
  localStorage.setItem(settingsKey, JSON.stringify({ editorMode: 'live' }))
  expect(readSettings()).toMatchObject({ editorMode: 'live', lastFormattedMode: 'live' })
  localStorage.setItem(settingsKey, JSON.stringify({ editorMode: 'source', lastFormattedMode: 'live' }))
  expect(readSettings()).toMatchObject({ editorMode: 'source', lastFormattedMode: 'live' })
})
