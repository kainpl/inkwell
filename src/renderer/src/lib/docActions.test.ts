import { guardUnsaved, saveDoc, saveDocAs, installAutosave } from './docActions'
import { useAppStore } from '@renderer/store/useAppStore'
import { useConfirm, type ConfirmChoice } from '@renderer/store/useConfirm'

function setDoc(dirty: boolean, path: string | null = '/tmp/x.md'): void {
  useAppStore.setState((s) => ({ doc: { ...s.doc, path, dirty } }))
}

/** Make the confirm dialog resolve immediately with `choice` (no real UI). */
function mockChoice(choice: ConfirmChoice): void {
  vi.spyOn(useConfirm.getState(), 'ask').mockResolvedValue(choice)
}

describe('guardUnsaved', () => {
  beforeEach(() => {
    setDoc(false)
    window.api = {
      saveFile: vi.fn().mockResolvedValue(true)
    } as unknown as typeof window.api
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('proceeds without asking when the document is clean', async () => {
    const askSpy = vi.spyOn(useConfirm.getState(), 'ask')
    expect(await guardUnsaved()).toBe(true)
    expect(askSpy).not.toHaveBeenCalled()
  })

  it('aborts when the user cancels', async () => {
    setDoc(true)
    mockChoice('cancel')
    expect(await guardUnsaved()).toBe(false)
  })

  it('proceeds (without saving) when the user discards', async () => {
    setDoc(true)
    mockChoice('discard')
    expect(await guardUnsaved()).toBe(true)
    expect(window.api.saveFile).not.toHaveBeenCalled()
  })

  it('saves to the current path when the user chooses Save', async () => {
    setDoc(true)
    mockChoice('save')
    expect(await guardUnsaved()).toBe(true)
    expect(window.api.saveFile).toHaveBeenCalledWith('/tmp/x.md', expect.any(String))
  })
})

describe('file writing preferences', () => {
  const store = useAppStore.getState()
  beforeEach(() => {
    store.configure({ autoSave: true, lineEnding: 'CRLF', finalNewline: true })
    store.newDoc()
    window.api = {
      saveFile: vi.fn().mockResolvedValue(true),
      saveFileAs: vi.fn().mockResolvedValue({ path: '/notes/test.md', name: 'test.md' })
    } as unknown as typeof window.api
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces named documents, preserves LF, and never prompts for untitled drafts', async () => {
    vi.useFakeTimers()
    const stop = installAutosave(vi.fn())
    try {
      store.setContent('draft')
      await vi.advanceTimersByTimeAsync(2000)
      expect(window.api.saveFileAs).not.toHaveBeenCalled()
      store.loadDoc({ path: '/test.md', name: 'test.md', content: 'one\ntwo' })
      store.setContent('one\nthree')
      await vi.advanceTimersByTimeAsync(600)
      store.setContent('one\nfour')
      await vi.advanceTimersByTimeAsync(901)
      expect(window.api.saveFile).toHaveBeenCalledTimes(1)
      expect(window.api.saveFile).toHaveBeenCalledWith('/test.md', 'one\nfour\n')
      expect(useAppStore.getState().doc.dirty).toBe(false)
    } finally {
      stop()
    }
  })
  it('keeps edits made during Save As dirty and transfers the word goal to the new path', async () => {
    let finish!: (result: { path: string; name: string; content: string }) => void
    vi.mocked(window.api.saveFileAs).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    store.setContent('first')
    store.setGoal(500)
    const saving = saveDocAs()
    await Promise.resolve()
    store.setContent('second')
    finish({ path: '/test.md', name: 'test.md', content: 'first\r\n' })
    expect(await saving).toBe(false)
    expect(window.api.saveFileAs).toHaveBeenCalledWith('first\r\n')
    expect(useAppStore.getState().doc.dirty).toBe(true)
    expect(useAppStore.getState().wordGoals['/test.md']).toBe(500)
    expect(await saveDoc()).toBe(true)
    expect(window.api.saveFile).toHaveBeenCalledWith('/test.md', 'second\r\n')
  })
  it('does not apply a completed save to a different document', async () => {
    let finish!: (ok: boolean) => void
    vi.mocked(window.api.saveFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    store.loadDoc({ path: '/old.md', name: 'old.md', content: 'old' })
    store.setContent('older')
    const saving = saveDoc()
    await Promise.resolve()
    store.newDoc()
    store.setContent('new')
    finish(true)
    expect(await saving).toBe(false)
    expect(useAppStore.getState().doc).toMatchObject({ path: null, dirty: true, content: 'new' })
  })
})
