import { gdriveRef, parseRef, isGdrive } from './drive'

describe('drive refs', () => {
  it('builds a gdrive uri', () => {
    expect(gdriveRef('acc1', 'file9')).toBe('gdrive://acc1/file9')
  })

  it('parses a gdrive uri', () => {
    expect(parseRef('gdrive://acc1/file9')).toEqual({
      provider: 'gdrive',
      accountId: 'acc1',
      fileId: 'file9'
    })
  })

  it('treats anything else as a local path', () => {
    expect(parseRef('D:/notes/a.md')).toEqual({ provider: 'local', path: 'D:/notes/a.md' })
    expect(parseRef(null)).toEqual({ provider: 'local', path: null })
  })

  it('round-trips ids with underscores/dashes', () => {
    const ref = gdriveRef('1085sub', '1a2B_xYz-9')
    expect(parseRef(ref)).toMatchObject({ accountId: '1085sub', fileId: '1a2B_xYz-9' })
  })

  it('isGdrive distinguishes the two', () => {
    expect(isGdrive('gdrive://a/b')).toBe(true)
    expect(isGdrive('C:/x.md')).toBe(false)
    expect(isGdrive(null)).toBe(false)
  })
})
