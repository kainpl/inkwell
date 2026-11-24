import { searchFolder, type FolderMatch } from './folderSearch'

it('searches nested files with literal case-insensitive matches and CRLF line numbers', async () => {
  window.api = {
    readDir: vi.fn(async (path: string) =>
      path === '/notes'
        ? [{ name: 'nested', path: '/notes/nested', type: 'directory' }]
        : [{ name: 'test.md', path: '/notes/nested/test.md', type: 'file' }]
    ),
    readDocumentText: vi.fn().mockResolvedValue('Heading\r\nSome ТЕСТ [*]\r\nOther text')
  } as unknown as typeof window.api
  const found: FolderMatch[] = []
  const result = await searchFolder('/notes', 'тест [*]', new AbortController().signal, (batch) =>
    found.push(...batch)
  )
  expect(result).toEqual({ count: 1, skipped: 0, limited: false })
  expect(found[0]).toMatchObject({ path: '/notes/nested/test.md', line: 2, column: 5 })
})
