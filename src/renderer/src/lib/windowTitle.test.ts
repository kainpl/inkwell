import { documentTitle, windowTitle } from './windowTitle'

describe('documentTitle', () => {
  it('uses the first heading when the document has one', () => {
    expect(documentTitle('notes.md', '# My Great Note\n\nbody')).toBe('My Great Note')
    expect(documentTitle('notes.md', 'intro\n\n## Section A\n## Section B')).toBe('Section A')
  })

  it('falls back to the file name without extension when there are no headings', () => {
    expect(documentTitle('shopping-list.md', 'milk\neggs')).toBe('shopping-list')
    expect(documentTitle('README.markdown', 'no headings here')).toBe('README')
  })

  it('ignores a # inside a fenced code block', () => {
    expect(documentTitle('snippet.md', '```\n# not a heading\n```\n# Real Title')).toBe('Real Title')
  })

  it('falls back to the name when the only heading is empty', () => {
    expect(documentTitle('empty.md', '#\nbody')).toBe('empty')
  })
})

describe('windowTitle', () => {
  it('appends the app name, heading first', () => {
    expect(windowTitle('notes.md', '# Hello', false)).toBe('Hello - Inkwell')
  })

  it('marks unsaved changes with a leading bullet', () => {
    expect(windowTitle('notes.md', '# Hello', true)).toBe('• Hello - Inkwell')
  })
})
