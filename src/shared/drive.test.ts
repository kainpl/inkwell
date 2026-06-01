import { gdriveRef, parseRef, isGdrive, mapDriveFiles, isGoogleDoc, isConflict } from './drive'

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

describe('mapDriveFiles', () => {
  const files = [
    { id: 'd1', name: 'Notes', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-01-01T00:00:00Z' },
    { id: 'f1', name: 'a.md', mimeType: 'text/markdown', modifiedTime: '2026-01-02T00:00:00Z' },
    { id: 'f2', name: 'b.txt', mimeType: 'text/plain', modifiedTime: '2026-01-03T00:00:00Z' }
  ]

  it('marks folders vs files and sorts folders-first then by name', () => {
    const nodes = mapDriveFiles(files)
    expect(nodes.map((n) => [n.name, n.type])).toEqual([
      ['Notes', 'directory'],
      ['a.md', 'file'],
      ['b.txt', 'file']
    ])
  })

  it('tolerates a missing modifiedTime', () => {
    expect(mapDriveFiles([{ id: 'x', name: 'x', mimeType: 'text/markdown' }])[0].modifiedTime).toBe('')
  })

  it('flags Google-native docs', () => {
    expect(isGoogleDoc('application/vnd.google-apps.document')).toBe(true)
    expect(isGoogleDoc('application/vnd.google-apps.folder')).toBe(false)
    expect(isGoogleDoc('text/markdown')).toBe(false)
  })

  it('resolves shortcuts to their target (keeping the shortcut name)', () => {
    const nodes = mapDriveFiles([
      {
        id: 'sc1',
        name: 'Shared note',
        mimeType: 'application/vnd.google-apps.shortcut',
        shortcutDetails: { targetId: 'real1', targetMimeType: 'text/markdown' }
      },
      {
        id: 'sc2',
        name: 'Shared folder',
        mimeType: 'application/vnd.google-apps.shortcut',
        shortcutDetails: { targetId: 'realDir', targetMimeType: 'application/vnd.google-apps.folder' }
      }
    ])
    expect(nodes).toEqual([
      { id: 'realDir', name: 'Shared folder', type: 'directory', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '' },
      { id: 'real1', name: 'Shared note', type: 'file', mimeType: 'text/markdown', modifiedTime: '' }
    ])
  })
})

describe('isConflict', () => {
  it('flags a remote change since the doc was loaded', () => {
    expect(isConflict('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(true)
    expect(isConflict('2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(false)
    expect(isConflict('2026-01-02T00:00:00Z', '')).toBe(false) // unknown remote → don't block
    expect(isConflict('', '2026-01-02T00:00:00Z')).toBe(false) // unknown base → don't block
  })
})
