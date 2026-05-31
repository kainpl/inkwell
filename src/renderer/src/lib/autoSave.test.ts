import { shouldAutoSave, startAutoSave } from './autoSave'
import { useAppStore } from '@renderer/store/useAppStore'

describe('shouldAutoSave', () => {
  it('runs only when enabled, dirty, and the document has a path', () => {
    expect(shouldAutoSave({ enabled: true, dirty: true, hasPath: true })).toBe(true)
    expect(shouldAutoSave({ enabled: false, dirty: true, hasPath: true })).toBe(false)
    expect(shouldAutoSave({ enabled: true, dirty: false, hasPath: true })).toBe(false)
    expect(shouldAutoSave({ enabled: true, dirty: true, hasPath: false })).toBe(false)
  })
})

describe('startAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAppStore.setState((s) => ({
      autoSave: false,
      doc: { ...s.doc, path: '/tmp/a.md', dirty: false }
    }))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves once after the debounce when conditions are met', () => {
    const save = vi.fn()
    const stop = startAutoSave(1000, save)
    useAppStore.setState((s) => ({ autoSave: true, doc: { ...s.doc, dirty: true } }))
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1)
    stop()
  })

  it('debounces rapid edits into a single save', () => {
    const save = vi.fn()
    const stop = startAutoSave(1000, save)
    useAppStore.setState((s) => ({ autoSave: true, doc: { ...s.doc, dirty: true } }))
    vi.advanceTimersByTime(500)
    // Another change resets the timer.
    useAppStore.setState((s) => ({ doc: { ...s.doc, content: s.doc.content + 'x', dirty: true } }))
    vi.advanceTimersByTime(500)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(save).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not save an unsaved (path-less) document', () => {
    const save = vi.fn()
    const stop = startAutoSave(1000, save)
    useAppStore.setState((s) => ({ autoSave: true, doc: { ...s.doc, path: null, dirty: true } }))
    vi.advanceTimersByTime(1000)
    expect(save).not.toHaveBeenCalled()
    stop()
  })
})
