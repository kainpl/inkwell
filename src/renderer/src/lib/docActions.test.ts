import { closeDocument, closeFolder, guardUnsaved, fillTemplate } from './docActions'
import { useAppStore } from '@renderer/store/useAppStore'
import { useConfirm, type ConfirmChoice } from '@renderer/store/useConfirm'
import type { FileNode } from '@shared/ipc'

const FOLDER: FileNode = { path: '/r', name: 'r', type: 'directory' }

function setDoc(dirty: boolean, path: string | null = '/tmp/x.md'): void {
  useAppStore.setState((s) => ({ doc: { ...s.doc, path, dirty } }))
}

/** Make the confirm dialog resolve immediately with `choice` (no real UI). */
function mockChoice(choice: ConfirmChoice): void {
  vi.spyOn(useConfirm.getState(), 'ask').mockResolvedValue(choice)
}

describe('fillTemplate', () => {
  it('substitutes the {date} token', () => {
    expect(fillTemplate('Written {date}, draft {date}.', '2026-05-31')).toBe(
      'Written 2026-05-31, draft 2026-05-31.'
    )
  })
  it('leaves text without tokens unchanged', () => {
    expect(fillTemplate('# Plain', '2026-05-31')).toBe('# Plain')
  })
})

describe('guardUnsaved', () => {
  beforeEach(() => {
    setDoc(false)
    window.api = {
      saveFile: vi.fn().mockResolvedValue(true),
      saveVersion: vi.fn().mockResolvedValue(true),
      getWelcome: vi.fn().mockResolvedValue('# Welcome')
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

describe('close commands', () => {
  function openOneTab(dirty: boolean): void {
    useAppStore.setState({
      tabs: [{ id: 't1', path: '/x.md', name: 'x.md', content: 'a', dirty }],
      activeId: 't1',
      doc: { path: '/x.md', name: 'x.md', content: 'a', dirty },
      root: FOLDER
    })
  }

  beforeEach(() => {
    window.api = {
      getWelcome: vi.fn().mockResolvedValue('# Welcome'),
      saveFile: vi.fn().mockResolvedValue(true),
      saveVersion: vi.fn().mockResolvedValue(true)
    } as unknown as typeof window.api
    openOneTab(false)
  })
  afterEach(() => vi.restoreAllMocks())

  it('closeFolder clears the workspace and resets to the welcome doc', async () => {
    await closeFolder()
    expect(useAppStore.getState().root).toBeNull()
    expect(useAppStore.getState().tabs).toHaveLength(1)
    expect(useAppStore.getState().doc.path).toBeNull()
    expect(useAppStore.getState().doc.content).toBe('# Welcome')
    expect(useAppStore.getState().doc.dirty).toBe(false)
  })

  it('closeDocument closes the active tab, falling back to welcome on the last', async () => {
    await closeDocument()
    expect(useAppStore.getState().root).toBe(FOLDER) // folder stays open
    expect(useAppStore.getState().doc.path).toBeNull()
    expect(useAppStore.getState().doc.content).toBe('# Welcome')
  })

  it('aborts when a dirty tab cancels the guard', async () => {
    openOneTab(true)
    vi.spyOn(useConfirm.getState(), 'ask').mockResolvedValue('cancel')
    await closeFolder()
    expect(useAppStore.getState().root).toBe(FOLDER)
    expect(useAppStore.getState().doc.path).toBe('/x.md')
  })
})
