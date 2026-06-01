/** Map a git porcelain XY status code to a single display character. Pure. */
export function gitStatusChar(xy: string): string {
  const code = xy.trim()
  if (code === '??') return '?' // untracked
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'U' // conflict
  if (code.includes('R')) return 'R' // renamed
  if (code.includes('A')) return 'A' // added
  if (code.includes('D')) return 'D' // deleted
  if (code.includes('M')) return 'M' // modified
  return code[0] ?? 'M'
}
