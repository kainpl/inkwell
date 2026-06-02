import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, sep } from 'node:path'
import JSZip from 'jszip'
import type { DocRef, InkprojManifest, OpenedInkproj } from '../../shared/mindmap/types'

const DEFAULT_BASE = join(tmpdir(), 'inkwell-inkproj')

/** True iff `dest` stays inside `root` (path-traversal guard). */
function within(root: string, dest: string): boolean {
  return dest === root || dest.startsWith(root + sep)
}

/** Extract a `.inkproj` (ZIP) into a fresh working directory; returns its path. */
export async function extractInkproj(srcPath: string, baseDir: string = DEFAULT_BASE): Promise<string> {
  await mkdir(baseDir, { recursive: true })
  const workingDir = await mkdtemp(join(baseDir, 'p-'))
  const zip = await JSZip.loadAsync(await readFile(srcPath))
  for (const entry of Object.values(zip.files)) {
    const dest = resolve(workingDir, entry.name)
    if (!within(workingDir, dest)) throw new Error(`unsafe entry in .inkproj: ${entry.name}`)
    if (entry.dir) {
      await mkdir(dest, { recursive: true })
    } else {
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, await entry.async('nodebuffer'))
    }
  }
  return workingDir
}

/** Read + parse the manifest and the schema text from a working dir. */
export async function readManifestAndSchema(
  workingDir: string
): Promise<{ manifest: InkprojManifest; schema: string }> {
  const manifest = JSON.parse(
    await readFile(join(workingDir, 'manifest.json'), 'utf8')
  ) as InkprojManifest
  const schema = await readFile(join(workingDir, manifest.schema || 'schema.mind-map'), 'utf8')
  return { manifest, schema }
}

/** Open a project = extract + read manifest/schema. */
export async function openInkproj(srcPath: string, baseDir?: string): Promise<OpenedInkproj> {
  const workingDir = await extractInkproj(srcPath, baseDir)
  const { manifest, schema } = await readManifestAndSchema(workingDir)
  return { workingDir, manifest, schema }
}

/** Read an attached doc — an internal bundle path or an external on-disk `src`. */
export async function readDocFile(workingDir: string, ref: DocRef): Promise<string> {
  if (ref.external && ref.src) return readFile(ref.src, 'utf8')
  if (!ref.path) throw new Error('doc ref has no path')
  const dest = resolve(workingDir, ref.path)
  if (!within(workingDir, dest)) throw new Error(`unsafe doc path: ${ref.path}`)
  return readFile(dest, 'utf8')
}

/** Remove a working directory (best-effort). */
export async function cleanupInkproj(workingDir: string): Promise<void> {
  await rm(workingDir, { recursive: true, force: true })
}
