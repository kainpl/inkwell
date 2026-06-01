import { gitStatusChar } from './gitStatus'

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
