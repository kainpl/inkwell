import {
  guardUnsaved,
  guardAllUnsaved,
  closeTab,
  saveDoc,
  saveDocAs,
  installAutosave,
  installFileRefresh,
  reloadFromDisk,
  openRecent
} from './docActions'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'
import { useConfirm, type ConfirmChoice } from '@renderer/store/useConfirm'

function setDoc(dirty: boolean, path: string | null = '/tmp/x.md'): void {
  const state = useAppStore.getState()
  state.loadDoc({ path, name: 'x.md', content: 'original' })
  if (dirty) state.setContent('edited')
}

/** Make the confirm dialog resolve immediately with `choice` (no real UI). */
function mockChoice(choice: ConfirmChoice): void {
  vi.spyOn(useConfirm.getState(), 'ask').mockResolvedValue(choice)
}

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('guardUnsaved', () => {
  beforeEach(() => {
    setDoc(false)
    window.api = {
      readDocumentText: vi.fn(async () => activeTab(useAppStore.getState()).diskContent),
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

  it('opens another tab without discarding a dirty document and reuses an open path', async () => {
    setDoc(true)
    const original = activeTab(useAppStore.getState())
    window.api.restoreRecentAccess = vi.fn().mockResolvedValue(undefined)
    window.api.readFile = vi
      .fn()
      .mockResolvedValue({ path: '/new.md', name: 'new.md', content: 'new' })
    await openRecent('files', '/new.md')
    expect(activeTab(useAppStore.getState()).doc.path).toBe('/new.md')
    expect(useAppStore.getState().tabs).toContain(original)
    await openRecent('files', '/new.md')
    expect(window.api.readFile).toHaveBeenCalledTimes(1)
    mockChoice('cancel')
    expect(await guardAllUnsaved()).toBe(false)
    expect(activeTab(useAppStore.getState()).doc.path).toBe('/new.md')
    expect(useAppStore.getState().tabs).toContain(original)
    mockChoice('discard')
    await closeTab(original.id)
    expect(useAppStore.getState().tabs.some((tab) => tab.id === original.id)).toBe(false)
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
      readDocumentText: vi.fn(async () => activeTab(useAppStore.getState()).diskContent),
      saveFile: vi.fn().mockResolvedValue(true),
      saveFileAs: vi.fn().mockResolvedValue({ path: '/notes/test.md', name: 'test.md' })
    } as unknown as typeof window.api
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('autosaves a background tab without modifying the active document', async () => {
    vi.useFakeTimers()
    vi.mocked(window.api.readDocumentText).mockResolvedValue('first')
    const first = store.loadDoc({ path: '/first.md', name: 'first.md', content: 'first' })
    const stop = installAutosave(vi.fn())
    try {
      store.setContent('background edits')
      const second = store.loadDoc({ path: '/second.md', name: 'second.md', content: 'second' })
      await vi.advanceTimersByTimeAsync(901)
      expect(vi.mocked(window.api.saveFile).mock.calls).toEqual([['/first.md', 'background edits\r\n']])
      expect(activeTab(useAppStore.getState())).toMatchObject({
        id: second,
        doc: { content: 'second', dirty: false }
      })
      expect(useAppStore.getState().tabs.find((tab) => tab.id === first)?.doc.dirty).toBe(false)
    } finally {
      stop()
    }
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
      expect(activeTab(useAppStore.getState()).doc.dirty).toBe(false)
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
    expect(window.api.saveFileAs).toHaveBeenCalledWith(
      'first\r\n',
      expect.any(String),
      expect.any(Number)
    )
    expect(activeTab(useAppStore.getState()).doc.dirty).toBe(true)
    expect(useAppStore.getState().wordGoals['/test.md']).toBe(500)
    expect(await saveDoc()).toBe(true)
    expect(window.api.saveFile).toHaveBeenCalledWith('/test.md', 'second\r\n')
  })
  it('does not apply a completed save to a different document', async () => {
    let finish!: (ok: boolean) => void
    let start!: () => void
    const started = new Promise<void>((resolve) => {
      start = resolve
    })
    vi.mocked(window.api.saveFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
          start()
        })
    )
    store.loadDoc({ path: '/old.md', name: 'old.md', content: 'old' })
    store.setContent('older')
    const saving = saveDoc()
    await started
    store.newDoc()
    store.setContent('new')
    finish(true)
    expect(await saving).toBe(true)
    expect(useAppStore.getState().tabs.find((tab) => tab.doc.path === '/old.md')?.doc.dirty).toBe(
      false
    )
    expect(activeTab(useAppStore.getState()).doc).toMatchObject({
      path: null,
      dirty: true,
      content: 'new'
    })
  })

  it('reloads clean files, retries a replacement, and keeps dirty edits when autosave races a change', async () => {
    vi.useFakeTimers()
    store.loadDoc({ path: '/note.md', name: 'note.md', content: 'original' })
    const id = useAppStore.getState().documentId
    const read = vi.mocked(window.api.readDocumentText)
    read.mockRejectedValueOnce(new Error('temporarily absent')).mockResolvedValue('updated\n')
    const stopRefresh = installFileRefresh()
    const stopAutosave = installAutosave(vi.fn())
    try {
      await vi.advanceTimersByTimeAsync(1000)
      expect(activeTab(useAppStore.getState()).doc).toMatchObject({
        content: 'updated\n',
        dirty: false
      })
      expect(useAppStore.getState().documentId).toBe(id)
      store.setContent('local edits')
      read.mockResolvedValue('another external version')
      await vi.advanceTimersByTimeAsync(900)
      expect(window.api.saveFile).not.toHaveBeenCalled()
      expect(activeTab(useAppStore.getState()).doc).toMatchObject({
        content: 'local edits',
        dirty: true
      })
      expect(activeTab(useAppStore.getState()).externalChange).toBe(true)
      expect(await saveDoc()).toBe(false)
      await reloadFromDisk()
      expect(activeTab(useAppStore.getState()).doc).toMatchObject({
        content: 'another external version',
        dirty: false
      })
      expect(activeTab(useAppStore.getState()).externalChange).toBe(false)
    } finally {
      stopRefresh()
      stopAutosave()
    }
  })
})
