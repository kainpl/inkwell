import { guardUnsaved } from './docActions'
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
