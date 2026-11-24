import { act, fireEvent, render } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'
import Editor from './Editor'

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

it('keeps formatting and tables visible while editing and shares source and undo across all modes', () => {
  const store = useAppStore.getState()
  const content = '# **Heading**\n\n| Item | Note |\n| :----- | --- |\n| **Old** | keep \\| this |'
  store.loadDoc({ path: null, name: 'visual.md', content })
  store.configure({ editorMode: 'visual' })
  const { container } = render(<Editor />)
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
  expect(view.contentDOM.querySelector('.ink-h1')?.textContent).not.toContain('**')
  act(() => view.dispatch({ selection: { anchor: view.state.doc.line(1).to } }))
  fireEvent.keyDown(view.contentDOM, { key: 'Backspace' })
  expect(view.state.doc.line(1).text).toBe('# **Headin**')
  act(() => {
    expect(undo(view)).toBe(true)
  })
  const cell = container.querySelector<HTMLElement>('.ink-table td .ink-visual-cell')!
  fireEvent.keyDown(cell, { key: 'Enter' })
  const nested = EditorView.findFromDOM(cell.querySelector('.cm-editor')!)!
  expect(nested.contentDOM.textContent).toBe('Old')
  act(() => nested.dispatch({ changes: { from: 2, to: 5, insert: 'Updated | value' } }))
  const edited = content.replace('**Old**', '**Updated \\| value**')
  expect(view.state.doc.toString()).toBe(edited)
  expect(activeTab(useAppStore.getState()).doc.content).toBe(edited)
  expect(EditorView.findFromDOM(cell.querySelector('.cm-editor')!)).toBe(nested)
  act(() => store.toggleSourceMode())
  expect(view.contentDOM.textContent).toContain('**Updated')
  act(() => store.toggleSourceMode())
  expect(container.querySelector('.ink-table td strong')?.textContent).toBe('Updated | value')
  act(() => {
    expect(undo(view)).toBe(true)
  })
  expect(view.state.doc.toString()).toBe(content)
})

it('restores each tab’s text, selection and undo history when switching', () => {
  const store = useAppStore.getState()
  const first = store.loadDoc({ path: '/first.md', name: 'first.md', content: 'Original' })
  const { container } = render(<Editor />)
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
  act(() => view.dispatch({ changes: { from: 8, insert: ' edited' }, selection: { anchor: 10 } }))
  act(() => {
    store.loadDoc({ path: '/second.md', name: 'second.md', content: 'Second tab' })
  })
  expect(view.state.doc.toString()).toBe('Second tab')
  expect(undo(view)).toBe(false)
  act(() => store.activateTab(first))
  expect(view.state.selection.main.head).toBe(10)
  expect(view.state.doc.toString()).toBe('Original edited')
  act(() => {
    expect(undo(view)).toBe(true)
  })
  expect(activeTab(useAppStore.getState()).doc.content).toBe('Original')
})

it('keeps table IDs intact and preserves explicit breaks and inline formatting', () => {
  const content =
    'Notes\n\n| ID | Notes |\n| --- | --- |\n| **1.3.2/N01** | Two words<br>[more details](#more) · `<br>` |'
  useAppStore.getState().loadDoc({ path: null, name: 'table.md', content })
  const { container } = render(<Editor />)
  const [id, notes] = container.querySelectorAll('.ink-table td .ink-visual-cell')
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
    'Audit',
    '',
    '| Queue | Example |',
    '| --- | --- |',
    '| [N01](#v132-n01) | `' + tag + '` |',
    '',
    '| ID | Feature |',
    '| --- | --- |',
    '| ' + tag + '**1.3.2/N01** | H3C |'
  ].join('\n')
  useAppStore.getState().loadDoc({ path: null, name: 'audit.md', content })
  const { container } = render(<Editor />)
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
  expect(container.querySelector('.ink-table strong')?.parentElement?.textContent).toBe('1.3.2/N01')
  expect(container.querySelector('.ink-table code')?.textContent).toBe(tag)
  const link = container.querySelector('.ink-table a[href="#v132-n01"]')!
  act(() => {
    link.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, ctrlKey: true })
    )
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
  })
  expect(view.state.selection.main.head).toBe(content.lastIndexOf(tag))
  expect(activeTab(useAppStore.getState()).doc).toMatchObject({ content, dirty: false })
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
  expect(activeTab(useAppStore.getState()).doc.dirty).toBe(false)
  act(() => view.dispatch({ changes: { from: 2, insert: 'My ' }, selection: { anchor: 5 } }))
  expect(activeTab(useAppStore.getState()).doc.content).toBe('# My Note\r\n\r\n- [ ] task')
  act(() => store.toggleSourceMode())
  expect(view.state.selection.main.head).toBe(5)
  act(() => {
    expect(undo(view)).toBe(true)
  })
  expect(activeTab(useAppStore.getState()).doc.content).toBe(file.content)
  act(() => store.loadDoc({ ...file, path: 'other.md' }))
  expect(undo(view)).toBe(false)
  expect(activeTab(useAppStore.getState()).doc.dirty).toBe(false)
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
  expect(activeTab(useAppStore.getState()).doc).toMatchObject({ content, dirty: false })
})

it('keeps the selection on the same text after disjoint changes on disk in both modes', () => {
  const store = useAppStore.getState()
  for (const sourceMode of [false, true]) {
    store.configure({ editorMode: sourceMode ? 'source' : 'live' })
    store.loadDoc({
      path: sourceMode ? 'source.md' : 'notes.md',
      name: 'notes.md',
      content: 'start\n\nselected words\n\nend'
    })
    const { container, unmount } = render(<Editor />)
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!
    act(() => view.dispatch({ selection: { anchor: 7, head: 21 } }))
    act(() => store.receiveDiskContent('before start\r\n\r\nselected words\r\n\r\nend after'))
    const { from, to } = view.state.selection.main
    expect(view.state.sliceDoc(from, to)).toBe('selected words')
    expect(undo(view)).toBe(false)
    expect(activeTab(useAppStore.getState()).doc.dirty).toBe(false)
    act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: '\nlocal' } }))
    expect(activeTab(useAppStore.getState()).doc.content).toMatch(/end after\r\nlocal$/)
    act(() => store.receiveDiskContent('AAAAA\nBBBBB\nCCCCCC\nDDDDD\nEEEEE', true))
    expect(view.state.doc.lineAt(view.state.selection.main.from).number).toBe(3)
    unmount()
  }
})
