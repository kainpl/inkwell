import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { insertLocalImage } from './imageInsert'
import { useAppStore } from '@renderer/store/useAppStore'

function makeView(doc = ''): EditorView {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state: EditorState.create({ doc }), parent })
}

describe('insertLocalImage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('copies the picked image into assets/ and inserts a relative-path image', async () => {
    useAppStore.setState((s) => ({ doc: { ...s.doc, path: 'D:/notes/a.md', content: '' } }))
    const saveImage = vi.fn().mockResolvedValue('assets/cat.png')
    window.api = {
      pickImage: vi.fn().mockResolvedValue({ name: 'cat.png', data: new Uint8Array([1, 2, 3]) }),
      saveImage
    } as unknown as typeof window.api

    const view = makeView('')
    await insertLocalImage(view)

    expect(saveImage).toHaveBeenCalledWith('D:/notes/a.md', 'cat.png', expect.any(Uint8Array))
    expect(view.state.doc.toString()).toBe('![cat](assets/cat.png)')
    view.destroy()
  })

  it('embeds a data: URL when the document is unsaved', async () => {
    useAppStore.setState((s) => ({ doc: { ...s.doc, path: null, content: '' } }))
    window.api = {
      pickImage: vi.fn().mockResolvedValue({ name: 'cat.png', data: new Uint8Array([1, 2, 3]) }),
      saveImage: vi.fn()
    } as unknown as typeof window.api

    const view = makeView('')
    await insertLocalImage(view)

    expect(window.api.saveImage).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toMatch(/^!\[cat\]\(data:image\/png;base64,/)
    view.destroy()
  })

  it('does nothing when the dialog is canceled', async () => {
    window.api = { pickImage: vi.fn().mockResolvedValue(null) } as unknown as typeof window.api
    const view = makeView('hello')
    await insertLocalImage(view)
    expect(view.state.doc.toString()).toBe('hello')
    view.destroy()
  })
})
