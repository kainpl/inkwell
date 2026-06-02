import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, sep } from 'node:path'
import JSZip from 'jszip'
import type { DocRef, InkprojManifest, OpenedInkproj } from '../../shared/mindmap/types'

const DEFAULT_BASE = join(tmpdir(), 'inkwell-inkproj')

/**
 * Working dirs we created via `extractInkproj`. Reads only ever resolve against
 * one of these — a `workingDir` argument that didn't come from us is rejected,
 * so a compromised renderer can't aim the reader at an arbitrary directory.
 */
const KNOWN_WORKING_DIRS = new Set<string>()

/** True iff `dest` stays inside `root` (path-traversal guard). */
function within(root: string, dest: string): boolean {
  return dest === root || dest.startsWith(root + sep)
}

/** Resolve `rel` under `root`, symlink-safe (realpath); null if it escapes `root`. */
async function safeResolve(root: string, rel: string): Promise<string | null> {
  const realRoot = await realpath(root)
  const dest = await realpath(resolve(realRoot, rel)).catch(() => null)
  return dest && within(realRoot, dest) ? dest : null
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
  KNOWN_WORKING_DIRS.add(workingDir)
  return workingDir
}

/** Read + parse the manifest and the schema text from a working dir. */
export async function readManifestAndSchema(
  workingDir: string
): Promise<{ manifest: InkprojManifest; schema: string }> {
  const manifest = JSON.parse(
    await readFile(join(workingDir, 'manifest.json'), 'utf8')
  ) as InkprojManifest
  // `manifest.schema` comes from the untrusted project file — keep it in-bundle.
  const schemaDest = await safeResolve(workingDir, manifest.schema || 'schema.mind-map')
  if (!schemaDest) throw new Error('unsafe schema path')
  const schema = await readFile(schemaDest, 'utf8')
  return { manifest, schema }
}

/** Open a project = extract + read manifest/schema. */
export async function openInkproj(srcPath: string, baseDir?: string): Promise<OpenedInkproj> {
  const workingDir = await extractInkproj(srcPath, baseDir)
  const { manifest, schema } = await readManifestAndSchema(workingDir)
  return { workingDir, manifest, schema }
}

/**
 * Read a node's attached doc from inside the bundle. `workingDir` must be one we
 * created; `ref.path` must resolve within it (symlink-safe). External refs are
 * NOT read here — an `external` doc must be opened through a user-driven file
 * picker (a manifest-supplied absolute `src` would be arbitrary file read; D7).
 */
export async function readDocFile(workingDir: string, ref: DocRef): Promise<string> {
  if (!KNOWN_WORKING_DIRS.has(workingDir)) throw new Error('unknown workingDir')
  if (ref.external) throw new Error('external doc refs must be opened via a user file picker')
  if (!ref.path) throw new Error('doc ref has no path')
  const dest = await safeResolve(workingDir, ref.path)
  if (!dest) throw new Error(`unsafe doc path: ${ref.path}`)
  return readFile(dest, 'utf8')
}

/** Remove a working directory (best-effort). */
export async function cleanupInkproj(workingDir: string): Promise<void> {
  KNOWN_WORKING_DIRS.delete(workingDir)
  await rm(workingDir, { recursive: true, force: true })
}
