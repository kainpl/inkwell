/** Pure GFM table model: parse, serialize, and structural edits. */

export type Align = 'left' | 'center' | 'right' | 'none'

export interface TableModel {
  /** Header cell texts. */
  header: string[]
  /** Per-column alignment (same length as header). */
  aligns: Align[]
  /** Body rows; each is an array of cell texts (padded to column count). */
  rows: string[][]
}

/** Split a `| a | b |` row into trimmed cell texts (ignoring outer pipes). */
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  // Split on unescaped pipes.
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (s[i] === '|') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += s[i]
    }
  }
  cells.push(cur.trim())
  return cells
}

/** Parse a delimiter cell like `:---`, `:-:`, `---:` into an alignment. */
function parseAlign(cell: string): Align {
  const t = cell.trim()
  const left = t.startsWith(':')
  const right = t.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return 'none'
}

/** True if a line looks like a table delimiter row (`| --- | :-: |`). */
function isDelimiter(line: string): boolean {
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()))
}

/** Parse a markdown table block. Returns null if it is not a valid table. */
export function parseTable(md: string): TableModel | null {
  const lines = md.split('\n').filter((l) => l.trim() !== '')
  if (lines.length < 2 || !isDelimiter(lines[1])) return null
  const header = splitRow(lines[0])
  const aligns = splitRow(lines[1]).map(parseAlign)
  // Normalize align length to header length.
  while (aligns.length < header.length) aligns.push('none')
  aligns.length = header.length
  const rows = lines.slice(2).map((l) => {
    const cells = splitRow(l)
    while (cells.length < header.length) cells.push('')
    cells.length = header.length
    return cells
  })
  return { header, aligns, rows }
}

const ALIGN_DELIM: Record<Align, string> = {
  left: ':---',
  center: ':-:',
  right: '---:',
  none: '---'
}

/** Serialize a model back to GFM markdown. */
export function serializeTable(t: TableModel): string {
  const esc = (s: string): string => s.replace(/\|/g, '\\|')
  const row = (cells: string[]): string => '| ' + cells.map(esc).join(' | ') + ' |'
  const lines = [
    row(t.header),
    '| ' + t.aligns.map((a) => ALIGN_DELIM[a]).join(' | ') + ' |',
    ...t.rows.map(row)
  ]
  return lines.join('\n')
}

const emptyRow = (cols: number): string[] => Array.from({ length: cols }, () => '')

/** Insert an empty row at `index` (clamped). Returns a new model. */
export function addRow(t: TableModel, index: number): TableModel {
  const rows = t.rows.slice()
  const at = Math.max(0, Math.min(index, rows.length))
  rows.splice(at, 0, emptyRow(t.header.length))
  return { ...t, rows }
}

/** Delete the body row at `index` (no-op if out of range). */
export function deleteRow(t: TableModel, index: number): TableModel {
  if (index < 0 || index >= t.rows.length) return t
  const rows = t.rows.slice()
  rows.splice(index, 1)
  return { ...t, rows }
}

/** Insert an empty column at `index` (clamped). */
export function addColumn(t: TableModel, index: number): TableModel {
  const at = Math.max(0, Math.min(index, t.header.length))
  const header = t.header.slice()
  header.splice(at, 0, '')
  const aligns = t.aligns.slice()
  aligns.splice(at, 0, 'none')
  const rows = t.rows.map((r) => {
    const nr = r.slice()
    nr.splice(at, 0, '')
    return nr
  })
  return { header, aligns, rows }
}

/** Delete the column at `index` (no-op if it would leave no columns). */
export function deleteColumn(t: TableModel, index: number): TableModel {
  if (t.header.length <= 1 || index < 0 || index >= t.header.length) return t
  const header = t.header.slice()
  header.splice(index, 1)
  const aligns = t.aligns.slice()
  aligns.splice(index, 1)
  const rows = t.rows.map((r) => {
    const nr = r.slice()
    nr.splice(index, 1)
    return nr
  })
  return { header, aligns, rows }
}

/** Set a column's alignment. */
export function setColumnAlign(t: TableModel, index: number, align: Align): TableModel {
  if (index < 0 || index >= t.aligns.length) return t
  const aligns = t.aligns.slice()
  aligns[index] = align
  return { ...t, aligns }
}
