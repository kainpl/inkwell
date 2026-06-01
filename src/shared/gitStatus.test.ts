import { gitStatusChar, parseGitChanges } from './gitStatus'

describe('gitStatusChar', () => {
  it('maps the common porcelain codes', () => {
    expect(gitStatusChar('??')).toBe('?') // untracked
    expect(gitStatusChar(' M')).toBe('M') // modified (unstaged)
    expect(gitStatusChar('M ')).toBe('M') // modified (staged)
    expect(gitStatusChar('A ')).toBe('A') // added
    expect(gitStatusChar(' D')).toBe('D') // deleted
    expect(gitStatusChar('R ')).toBe('R') // renamed
  })

  it('treats merge conflicts as U', () => {
    expect(gitStatusChar('UU')).toBe('U')
    expect(gitStatusChar('AA')).toBe('U')
  })
})

describe('parseGitChanges', () => {
  it('reads the branch from the porcelain --branch header', () => {
    expect(parseGitChanges('## main...origin/main [ahead 1]\n').branch).toBe('main')
    expect(parseGitChanges('## dev\n').branch).toBe('dev')
    expect(parseGitChanges('## No commits yet on trunk\n').branch).toBe('trunk')
  })

  it('splits staged (index) from unstaged (worktree) changes', () => {
    const out = '## main\nM  staged.ts\n M worktree.ts\nA  added.ts\n?? new.md\n'
    const { staged, unstaged } = parseGitChanges(out)
    expect(staged.map((c) => c.path)).toEqual(['staged.ts', 'added.ts'])
    expect(unstaged.map((c) => c.path)).toEqual(['worktree.ts', 'new.md'])
    expect(unstaged.find((c) => c.path === 'new.md')?.worktree).toBe('?')
  })

  it('lists a file in both sections when index and worktree both changed (MM)', () => {
    const { staged, unstaged } = parseGitChanges('## main\nMM both.ts\n')
    expect(staged.map((c) => c.path)).toEqual(['both.ts'])
    expect(unstaged.map((c) => c.path)).toEqual(['both.ts'])
  })

  it('keeps the new path of a rename', () => {
    const { staged } = parseGitChanges('## main\nR  old.ts -> new.ts\n')
    expect(staged[0].path).toBe('new.ts')
    expect(staged[0].index).toBe('R')
  })
})
