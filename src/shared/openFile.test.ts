import { fileFromArgv } from './openFile'

describe('fileFromArgv', () => {
  it('finds a markdown path among the arguments', () => {
    expect(fileFromArgv(['app.exe', 'C:/docs/note.md'])).toBe('C:/docs/note.md')
  })

  it('skips the executable and flags', () => {
    expect(fileFromArgv(['electron', '--enable-logging', 'a.markdown'])).toBe('a.markdown')
  })

  it('returns null when no document path is present', () => {
    expect(fileFromArgv(['app.exe', '--flag'])).toBeNull()
    expect(fileFromArgv(['app.exe'])).toBeNull()
  })
})
