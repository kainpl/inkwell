import { COMMANDS, commandSearchText } from './commands'
import { fuzzyFilter } from './fuzzy'
import { IPC } from '@shared/ipc'

describe('command registry', () => {
  it('has unique ids', () => {
    const ids = COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every command has a title, a category and a channel', () => {
    expect(COMMANDS.every((c) => !!c.title && !!c.category && !!c.channel)).toBe(true)
  })

  it('format commands fire menuFormat with the action id as arg', () => {
    const bold = COMMANDS.find((c) => c.id === 'format.bold')
    expect(bold?.channel).toBe(IPC.menuFormat)
    expect(bold?.arg).toBe('bold')
  })

  it('pandoc exports carry the format as arg', () => {
    const docx = COMMANDS.find((c) => c.id === 'export.docx')
    expect(docx?.channel).toBe(IPC.menuExportPandoc)
    expect(docx?.arg).toBe('docx')
  })

  it('fuzzy-matches by category and title', () => {
    const res = fuzzyFilter(COMMANDS, 'format bold', commandSearchText)
    expect(res[0]?.title).toBe('Bold')
  })

  it('finds a view command from a loose query', () => {
    const res = fuzzyFilter(COMMANDS, 'sidebar', commandSearchText)
    expect(res.some((c) => c.id === 'view.sidebar')).toBe(true)
  })
})
