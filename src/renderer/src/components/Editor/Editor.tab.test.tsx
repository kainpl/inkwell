import { render, act, cleanup } from '@testing-library/react'
import { undo } from '@codemirror/commands'
import Editor from './Editor'
import { useAppStore } from '@renderer/store/useAppStore'
import { useEditor } from '@renderer/store/useEditor'
import { setCaret } from '@renderer/lib/persistence'

function resetStore(): void {
  useAppStore.setState({
    tabs: [{ id: 'init', path: null, name: 'Welcome.md', content: '', dirty: false }],
    activeId: 'init',
    doc: { path: null, name: 'Welcome.md', content: '', dirty: false }
  })
}

afterEach(cleanup)

it('preserves each tab content + undo history across switches', async () => {
  resetStore()
  render(<Editor />)
  const view = useEditor.getState().view
  expect(view).toBeTruthy()

  // Edit the initial tab (also makes it non-replaceable so opening adds a tab).
  act(() => view!.dispatch({ changes: { from: 0, insert: 'hello' } }))
  expect(useAppStore.getState().doc.content).toBe('hello')

  // Open a second file — a new tab; the editor swaps to it.
  await act(async () => {
    useAppStore.getState().openInTab({ path: '/a.md', name: 'a.md', content: 'AAA' })
  })
  expect(useEditor.getState().view!.state.doc.toString()).toBe('AAA')

  // Switch back to the first tab — its content is restored…
  await act(async () => useAppStore.getState().activateTab('init'))
  const v = useEditor.getState().view!
  expect(v.state.doc.toString()).toBe('hello')

  // …and so is its undo history (undo reverts the 'hello' insertion).
  act(() => undo(v))
  expect(v.state.doc.toString()).toBe('')
})

it('restores the remembered caret when a file is opened', async () => {
  resetStore()
  localStorage.clear()
  setCaret('/a.md', 3)
  render(<Editor />)
  await act(async () => {
    useAppStore.getState().openInTab({ path: '/a.md', name: 'a.md', content: 'AAAAA' })
  })
  const v = useEditor.getState().view!
  expect(v.state.doc.toString()).toBe('AAAAA')
  expect(v.state.selection.main.head).toBe(3)
})
