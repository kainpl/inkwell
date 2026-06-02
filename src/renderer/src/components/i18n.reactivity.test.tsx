import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StatusBar from './StatusBar'
import { useAppStore } from '@renderer/store/useAppStore'

/**
 * Guards the renderer i18n wiring: chrome reads strings through `useT()`, which
 * subscribes to `locale`, so flipping `locale` in the store must re-render the
 * visible text (no reload). StatusBar is a pure, dependency-light chrome piece.
 */
describe('chrome i18n reactivity', () => {
  afterEach(() => {
    act(() => useAppStore.setState({ locale: 'en' }))
  })

  it('renders chrome in the active locale and updates live on change', () => {
    act(() => useAppStore.setState({ locale: 'en' }))
    render(<StatusBar />)
    expect(screen.getByText('Typewriter')).toBeTruthy()

    act(() => useAppStore.setState({ locale: 'uk' }))
    expect(screen.getByText('Друкарка')).toBeTruthy()

    act(() => useAppStore.setState({ locale: 'ru' }))
    expect(screen.getByText('Печ. машинка')).toBeTruthy()
  })

  it('interpolates counts into translated strings', () => {
    act(() => useAppStore.setState({ locale: 'uk', doc: { path: null, name: 'x.md', content: 'one two', dirty: false } }))
    render(<StatusBar />)
    // uk 'status.words' = '{n} слів' → '2 слів'
    expect(screen.getByText('2 слів')).toBeTruthy()
  })
})
