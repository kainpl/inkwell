import { MAX_VERSIONS, shouldSnapshot, versionsToPrune } from './versions'

describe('shouldSnapshot', () => {
  it('snapshots when content differs from the latest version', () => {
    expect(shouldSnapshot('new', 'old')).toBe(true)
  })
  it('skips when content equals the latest version', () => {
    expect(shouldSnapshot('same', 'same')).toBe(false)
  })
  it('snapshots the first version (no latest yet)', () => {
    expect(shouldSnapshot('first', null)).toBe(true)
  })
  it('skips empty / whitespace-only content', () => {
    expect(shouldSnapshot('   \n  ', null)).toBe(false)
  })
})

describe('versionsToPrune', () => {
  it('keeps everything when at or under the cap', () => {
    expect(versionsToPrune([3, 1, 2], 3)).toEqual([])
    expect(versionsToPrune([1, 2], 3)).toEqual([])
  })
  it('drops the oldest beyond the cap', () => {
    expect(versionsToPrune([50, 10, 30, 20, 40], 3)).toEqual([10, 20])
  })
  it('does not mutate its input', () => {
    const input = [3, 1, 2]
    versionsToPrune(input, 1)
    expect(input).toEqual([3, 1, 2])
  })
  it('uses a sane default cap', () => {
    expect(MAX_VERSIONS).toBeGreaterThan(0)
  })
})
