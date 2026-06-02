// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest'
import JSZip from 'jszip'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openInkproj, readDocFile, saveInkproj, cleanupInkproj } from './zip'

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

  it('rejects an unknown workingDir (not one we extracted)', async () => {
    await expect(
      readDocFile(join(tmpdir(), 'nope-not-ours'), { path: 'docs/x.md' })
    ).rejects.toThrow(/unknown workingDir/)
  })

  it('refuses external doc refs (must go through a user file picker)', async () => {
    const { workingDir } = await openInkproj(await makeFixture())
    dirs.push(workingDir)
    await expect(
      readDocFile(workingDir, { external: true, src: join(tmpdir(), 'whatever') })
    ).rejects.toThrow(/file picker/)
  })

  it('saves a new schema back and re-opens it', async () => {
    const opened = await openInkproj(await makeFixture())
    dirs.push(opened.workingDir)
    await saveInkproj(
      opened.workingDir,
      { schema: '# T2\n\n- Zed <!-- mindmap {"id":"z"} -->\n' },
      opened.srcPath
    )
    const reopened = await openInkproj(opened.srcPath)
    dirs.push(reopened.workingDir)
    expect(reopened.schema).toContain('# T2')
    expect(reopened.schema).toContain('Zed')
  })

  it('saves manifest + edited docs, and rejects a path-traversal doc write', async () => {
    const opened = await openInkproj(await makeFixture())
    dirs.push(opened.workingDir)
    await saveInkproj(
      opened.workingDir,
      {
        schema: opened.schema,
        manifest: { ...opened.manifest, linkTypes: { mine: { label: 'mine', color: '#abc' } } },
        docs: [{ path: 'docs/x.md', content: '# Edited\n' }]
      },
      opened.srcPath
    )
    const reopened = await openInkproj(opened.srcPath)
    dirs.push(reopened.workingDir)
    expect(reopened.manifest.linkTypes?.mine?.label).toBe('mine')
    expect(await readDocFile(reopened.workingDir, { path: 'docs/x.md' })).toContain('# Edited')

    await expect(
      saveInkproj(reopened.workingDir, { schema: '# x\n', docs: [{ path: '../evil.md', content: 'x' }] }, reopened.srcPath)
    ).rejects.toThrow(/unsafe doc path/)
  })

  it('rejects save with a mismatched srcPath', async () => {
    const opened = await openInkproj(await makeFixture())
    dirs.push(opened.workingDir)
    await expect(
      saveInkproj(opened.workingDir, { schema: '# x\n' }, join(tmpdir(), 'other.inkproj'))
    ).rejects.toThrow(/path mismatch|unknown project/)
  })
})
