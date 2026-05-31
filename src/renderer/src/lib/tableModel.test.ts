import {
  parseTable,
  serializeTable,
  addRow,
  deleteRow,
  addColumn,
  deleteColumn,
  setColumnAlign
} from './tableModel'

const SAMPLE = '| Name | Age |\n| :--- | ---: |\n| Bob | 30 |\n| Al | 9 |'

describe('tableModel', () => {
  it('parses header, alignments and rows', () => {
    const t = parseTable(SAMPLE)!
    expect(t.header).toEqual(['Name', 'Age'])
    expect(t.aligns).toEqual(['left', 'right'])
    expect(t.rows).toEqual([
      ['Bob', '30'],
      ['Al', '9']
    ])
  })

  it('returns null for non-tables', () => {
    expect(parseTable('just text')).toBeNull()
    expect(parseTable('| a | b |')).toBeNull() // no delimiter row
  })

  it('round-trips through serialize/parse', () => {
    const t = parseTable(SAMPLE)!
    const again = parseTable(serializeTable(t))!
    expect(again).toEqual(t)
  })

  it('pads short rows to the column count', () => {
    const t = parseTable('| a | b | c |\n| - | - | - |\n| 1 |')!
    expect(t.rows[0]).toEqual(['1', '', ''])
  })

  it('adds and deletes rows', () => {
    const t = parseTable(SAMPLE)!
    expect(addRow(t, 1).rows).toEqual([['Bob', '30'], ['', ''], ['Al', '9']])
    expect(deleteRow(t, 0).rows).toEqual([['Al', '9']])
  })

  it('adds and deletes columns', () => {
    const t = parseTable(SAMPLE)!
    const wider = addColumn(t, 1)
    expect(wider.header).toEqual(['Name', '', 'Age'])
    expect(wider.rows[0]).toEqual(['Bob', '', '30'])
    const narrower = deleteColumn(t, 0)
    expect(narrower.header).toEqual(['Age'])
    expect(narrower.rows[0]).toEqual(['30'])
  })

  it('never deletes the last column', () => {
    const t = parseTable('| only |\n| - |\n| x |')!
    expect(deleteColumn(t, 0)).toEqual(t)
  })

  it('sets a column alignment', () => {
    const t = parseTable(SAMPLE)!
    expect(setColumnAlign(t, 0, 'center').aligns).toEqual(['center', 'right'])
  })

  it('escapes pipes in cell content on serialize', () => {
    const t = parseTable('| a |\n| - |\n| x\\|y |')!
    expect(t.rows[0][0]).toBe('x|y')
    expect(serializeTable(t)).toContain('x\\|y')
  })
})
