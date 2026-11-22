import { act, render } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import { useAppStore } from '@renderer/store/useAppStore'
import Editor from './Editor'

it('shares selection and undo between modes, preserves CRLF, and resets history on open', () => {
  const store = useAppStore.getState()
  const file = { path: 'C:/notes/test.md', name: 'test.md', content: '# Note\r\n\r\n- [ ] task' }
  store.loadDoc(file)
  const { container } = render(<Editor />)
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
  expect(container.querySelector('.ink-task')).toBeTruthy()
  act(() => store.toggleSourceMode())
  expect(container.querySelector('.ink-task')).toBeNull()
  expect(container.querySelector('.cm-lineNumbers')).toBeTruthy()
  expect(useAppStore.getState().doc.dirty).toBe(false)
  act(() => view.dispatch({ changes: { from: 2, insert: 'My ' }, selection: { anchor: 5 } }))
  expect(useAppStore.getState().doc.content).toBe('# My Note\r\n\r\n- [ ] task')
  act(() => store.toggleSourceMode())
  expect(view.state.selection.main.head).toBe(5)
  act(() => {
    expect(undo(view)).toBe(true)
  })
  expect(useAppStore.getState().doc.content).toBe(file.content)
  act(() => store.loadDoc(file))
  expect(undo(view)).toBe(false)
  expect(useAppStore.getState().doc.dirty).toBe(false)
})

it('reconfigures individual Markdown features in a mounted editor and keeps the document intact', () => {
  const store = useAppStore.getState()
  const content = [
    'caret',
    '',
    '# Heading {#custom}',
    '',
    '==mark== :smile: H~2~ ^sup^ $x$ [^one]',
    '',
    '[^one]: note',
    '',
    '[toc]',
    '',
    '> [!NOTE]',
    '> text',
    '',
    'Term',
    ': Meaning'
  ].join('\n')
  store.loadDoc({ path: null, name: 'notes.md', content })
  const { container } = render(<Editor />)
  const selectors = {
    highlight: '.ink-highlight',
    emoji: '.ink-emoji',
    subSup: '.ink-sub',
    math: '.ink-math',
    footnotes: '.ink-footnote',
    toc: '.ink-toc',
    alerts: '.ink-alert',
    defList: '.ink-dt'
  }
  for (const [feature, selector] of Object.entries(selectors)) {
    expect(container.querySelector(selector), feature).toBeTruthy()
    act(() =>
      store.configure({ features: { ...useAppStore.getState().features, [feature]: false } })
    )
    expect(container.querySelector(selector), feature).toBeNull()
  }
  act(() =>
    store.configure({ features: { ...useAppStore.getState().features, headingIds: false } })
  )
  expect(container.textContent).toContain('{#custom}')
  for (const source of ['[toc]', '[^one]', '[!NOTE]', '==mark==', ':smile:', 'H~2~', '$x$'])
    expect(container.textContent).toContain(source)
  expect(useAppStore.getState().doc).toMatchObject({ content, dirty: false })
})
