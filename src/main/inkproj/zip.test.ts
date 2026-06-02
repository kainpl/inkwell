// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest'
import JSZip from 'jszip'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openInkproj, readDocFile, cleanupInkproj } from './zip'

async function makeFixture(): Promise<string> {
  const zip = new JSZip()
  zip.file(
    'manifest.json',
    JSON.stringify({ format: 'inkproj', formatVersion: 1, title: 'T', schema: 'schema.mind-map' })
  )
  zip.file('schema.mind-map', '# T\n\n- A <!-- mindmap {"id":"a"} -->\n')
  zip.file('docs/x.md', '# Doc\n\ntext\n')
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  const dir = await mkdtemp(join(tmpdir(), 'inkfix-'))
  const p = join(dir, 'sample.inkproj')
  await writeFile(p, buf)
  return p
}

const dirs: string[] = []
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true })
})

describe('inkproj zip', () => {
  it('extracts + reads manifest, schema, and a bundled doc', async () => {
    const { workingDir, manifest, schema } = await openInkproj(await makeFixture())
    dirs.push(workingDir)
    expect(manifest.title).toBe('T')
    expect(schema).toContain('# T')
    expect(await readDocFile(workingDir, { path: 'docs/x.md' })).toContain('# Doc')
    await cleanupInkproj(workingDir)
  })

  it('rejects a path-traversal doc ref', async () => {
    const { workingDir } = await openInkproj(await makeFixture())
    dirs.push(workingDir)
    await expect(readDocFile(workingDir, { path: '../../../etc/passwd' })).rejects.toThrow()
  })
})
