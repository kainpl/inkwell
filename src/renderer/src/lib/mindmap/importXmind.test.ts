// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { importXmind } from './importXmind'

async function xmindZip(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(files)) zip.file(name, content)
  return zip.generateAsync({ type: 'uint8array' })
}

describe('importXmind', () => {
  it('parses XMind Zen content.json (rootTopic + attached + notes)', async () => {
    const json = JSON.stringify([
      {
        title: 'Sheet',
        rootTopic: {
          title: 'Root',
          notes: { plain: { content: 'a note' } },
          children: {
            attached: [{ title: 'A', children: { attached: [{ title: 'A1' }] } }, { title: 'B' }]
          }
        }
      }
    ])
    const r = await importXmind(await xmindZip({ 'content.json': json }))
    expect(r.title).toBe('Root')
    expect(r.outline[0].data?.note).toBe('a note')
    const kids = r.outline[0].children ?? []
    expect(kids.map((n) => n.name)).toEqual(['A', 'B'])
    expect(kids[0].children?.[0].name).toBe('A1')
  })

  it('falls back to content.xml (XMind 8)', async () => {
    const xml =
      '<xmap-content><sheet><topic><title>Root</title><children><topics type="attached">' +
      '<topic><title>A</title></topic><topic><title>B</title></topic>' +
      '</topics></children></topic></sheet></xmap-content>'
    const r = await importXmind(await xmindZip({ 'content.xml': xml }))
    expect(r.title).toBe('Root')
    expect((r.outline[0].children ?? []).map((n) => n.name)).toEqual(['A', 'B'])
  })

  it('throws on a zip without XMind content', async () => {
    await expect(importXmind(await xmindZip({ 'other.txt': 'x' }))).rejects.toThrow()
  })
})
