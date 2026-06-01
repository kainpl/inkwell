import type { GitChange, GitChanges } from './ipc'

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

/**
 * Parse `git status --porcelain=v1 --branch` output into branch + staged /
 * unstaged change lists. Pure. A file can appear in both lists (e.g. `MM`):
 * the index char (X) drives "staged", the worktree char (Y) drives "unstaged",
 * and `??` is treated as an untracked, unstaged change.
 */
export function parseGitChanges(out: string): GitChanges {
  let branch: string | null = null
  const staged: GitChange[] = []
  const unstaged: GitChange[] = []
  for (const line of out.split('\n')) {
    if (line.startsWith('## ')) {
      const head = line.slice(3)
      branch = head.startsWith('No commits yet on ')
        ? head.slice('No commits yet on '.length)
        : head.split(/\.\.\.| /)[0]
      continue
    }
    if (line.length < 4) continue
    const index = line[0]
    const worktree = line[1]
    let rel = line.slice(3)
    if (rel.includes(' -> ')) rel = rel.split(' -> ')[1] // renamed: keep the new path
    rel = rel.trim().replace(/^"|"$/g, '')
    if (!rel) continue
    const untracked = index === '?' && worktree === '?'
    if (!untracked && index !== ' ') staged.push({ path: rel, index, worktree: ' ' })
    if (untracked || worktree !== ' ') unstaged.push({ path: rel, index: ' ', worktree })
  }
  return { branch, staged, unstaged }
}
