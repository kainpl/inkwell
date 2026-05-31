import { closeDocument, closeFolder, guardUnsaved } from './docActions'
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
  beforeEach(() => {
    window.api = { getWelcome: vi.fn().mockResolvedValue('# Welcome') } as unknown as typeof window.api
    useAppStore.setState((s) => ({ doc: { ...s.doc, path: '/x.md', dirty: false }, root: FOLDER }))
  })
  afterEach(() => vi.restoreAllMocks())

  it('closeFolder clears the workspace and resets to the welcome doc', async () => {
    await closeFolder()
    expect(useAppStore.getState().root).toBeNull()
    expect(useAppStore.getState().doc.path).toBeNull()
    expect(useAppStore.getState().doc.content).toBe('# Welcome')
    expect(useAppStore.getState().doc.dirty).toBe(false)
  })

  it('closeDocument keeps the folder but resets to the welcome doc', async () => {
    await closeDocument()
    expect(useAppStore.getState().root).toBe(FOLDER)
    expect(useAppStore.getState().doc.path).toBeNull()
    expect(useAppStore.getState().doc.content).toBe('# Welcome')
  })

  it('aborts when the unsaved guard is canceled', async () => {
    useAppStore.setState((s) => ({ doc: { ...s.doc, dirty: true } }))
    vi.spyOn(useConfirm.getState(), 'ask').mockResolvedValue('cancel')
    await closeFolder()
    expect(useAppStore.getState().root).toBe(FOLDER)
    expect(useAppStore.getState().doc.path).toBe('/x.md')
  })
})
