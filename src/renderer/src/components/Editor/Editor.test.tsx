import { act, render } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import { useAppStore } from '@renderer/store/useAppStore'
import Editor from './Editor'

it('keeps table IDs intact and preserves explicit breaks and inline formatting', () => {
  const content = 'Notes\n\n| ID | Notes |\n| --- | --- |\n| **1.3.2/N01** | Two words<br>[more details](#more) · `<br>` |'
  useAppStore.getState().loadDoc({ path: null, name: 'table.md', content })
  const { container } = render(<Editor />)
  const [id, notes] = container.querySelectorAll('.ink-table td')
  expect(id.innerHTML).toBe('<strong>1.3.2/N01</strong>')
  expect(notes.childNodes[0].textContent).toBe('Two')
  expect(notes.childNodes[1].nodeName).toBe('WBR')
  expect(notes.querySelectorAll('br')).toHaveLength(1)
  expect(notes.querySelector('a[href="#more"]')?.textContent).toBe('more details')
  expect(notes.querySelector('code')?.textContent).toBe('<br>')
})

it('renders the audit ID and follows a fragment from a table cell to the exact source row', () => {
  const tag = '<a id="v132-n01"></a>'
  const content = [
    'Audit', '', '| Queue | Example |', '| --- | --- |',
    '| [N01](#v132-n01) | `' + tag + '` |', '',
    '| ID | Feature |', '| --- | --- |', '| ' + tag + '**1.3.2/N01** | H3C |'
  ].join('\n')
  useAppStore.getState().loadDoc({ path: null, name: 'audit.md', content })
  const { container } = render(<Editor />)
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
  expect(container.querySelector('.ink-table strong')?.parentElement?.textContent).toBe('1.3.2/N01')
  expect(container.querySelector('.ink-table code')?.textContent).toBe(tag)
  const link = container.querySelector('.ink-table a[href="#v132-n01"]')!
  act(() => {
    link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, ctrlKey: true }))
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
  })
  expect(view.state.selection.main.head).toBe(content.lastIndexOf(tag))
  expect(useAppStore.getState().doc).toMatchObject({ content, dirty: false })
})

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
