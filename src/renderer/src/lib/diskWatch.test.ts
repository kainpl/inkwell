import { externalChangeAction } from './diskWatch'

describe('externalChangeAction', () => {
  it('ignores when disk matches the current buffer', () => {
    expect(externalChangeAction(false, 'same', 'same')).toBe('ignore')
    expect(externalChangeAction(true, 'same', 'same')).toBe('ignore')
  })
  it('reloads a clean buffer that diverged on disk', () => {
    expect(externalChangeAction(false, 'disk', 'buffer')).toBe('reload')
  })
  it('prompts when a dirty buffer diverged on disk', () => {
    expect(externalChangeAction(true, 'disk', 'buffer')).toBe('prompt')
  })
})
