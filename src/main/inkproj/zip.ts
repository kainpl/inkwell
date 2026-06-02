import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  realpath,
  rename,
  readdir,
  copyFile,
  access
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, relative, sep, basename, extname } from 'node:path'
import JSZip from 'jszip'
import type {
  DocRef,
  InkprojManifest,
  InkprojSavePayload,
  OpenedInkproj
} from '../../shared/mindmap/types'

const DEFAULT_BASE = join(tmpdir(), 'inkwell-inkproj')

/**
 * Open projects: working dir → its source `.inkproj` path. Reads/writes only
 * ever resolve against a known working dir, and saving requires the `srcPath`
 * to match the one we opened — so a compromised renderer can't aim the
 * reader/writer at an arbitrary directory or file.
 */
const PROJECTS = new Map<string, string>()

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

/** Resolve a *write* target under `root` (file may not exist yet); null if it escapes. */
async function safeJoin(root: string, rel: string): Promise<string | null> {
  const realRoot = await realpath(root)
  const dest = resolve(realRoot, rel)
  return within(realRoot, dest) ? dest : null
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
  PROJECTS.set(workingDir, srcPath)
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
  return { workingDir, manifest, schema, srcPath }
}

/**
 * Read a node's attached doc from inside the bundle. `workingDir` must be one we
 * created; `ref.path` must resolve within it (symlink-safe). External refs are
 * NOT read here — an `external` doc must be opened through a user-driven file
 * picker (a manifest-supplied absolute `src` would be arbitrary file read; D7).
 */
export async function readDocFile(workingDir: string, ref: DocRef): Promise<string> {
  if (!PROJECTS.has(workingDir)) throw new Error('unknown workingDir')
  if (ref.external) throw new Error('external doc refs must be opened via a user file picker')
  if (!ref.path) throw new Error('doc ref has no path')
  const dest = await safeResolve(workingDir, ref.path)
  if (!dest) throw new Error(`unsafe doc path: ${ref.path}`)
  return readFile(dest, 'utf8')
}

const exists = (p: string): Promise<boolean> => access(p).then(() => true, () => false)

/** A free `docs/<name>.md` path under `workingDir` (suffixes `-1`, `-2`, … on clash). */
async function uniqueDocPath(workingDir: string, filename: string): Promise<string> {
  const ext = extname(filename) || '.md'
  const stem = basename(filename, extname(filename)) || 'doc'
  let rel = `docs/${stem}${ext}`
  for (let i = 1; await exists(join(workingDir, rel)); i++) rel = `docs/${stem}-${i}${ext}`
  return rel
}

/**
 * Copy a user-picked file into the bundle's `docs/` and return its in-bundle ref.
 * The source path comes ONLY from a main-side file dialog (D7) — never from the
 * renderer or a manifest. `workingDir` must be a known project dir.
 */
export async function attachDoc(
  workingDir: string,
  srcPath: string
): Promise<{ path: string; title: string }> {
  if (!PROJECTS.has(workingDir)) throw new Error('unknown workingDir')
  const rel = await uniqueDocPath(workingDir, basename(srcPath))
  const dest = await safeJoin(workingDir, rel)
  if (!dest) throw new Error(`unsafe doc path: ${rel}`)
  await mkdir(dirname(dest), { recursive: true })
  await copyFile(srcPath, dest)
  return { path: rel, title: basename(srcPath, extname(srcPath)) }
}

async function* walkFiles(dir: string, base = dir): AsyncGenerator<{ abs: string; rel: string }> {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, ent.name)
    if (ent.isDirectory()) yield* walkFiles(abs, base)
    else yield { abs, rel: relative(base, abs).split(sep).join('/') }
  }
}

/**
 * Write the bundle's dirty parts (schema, optional manifest, edited docs) into the
 * working dir, re-zip it, and atomically replace the source `.inkproj`. `workingDir`
 * must be known and `srcPath` must match the one this project was opened from. Every
 * write target is path-validated to stay inside the working dir.
 */
export async function saveInkproj(
  workingDir: string,
  payload: InkprojSavePayload,
  srcPath: string
): Promise<void> {
  if (PROJECTS.get(workingDir) !== srcPath) throw new Error('unknown project or path mismatch')
  const manifest =
    payload.manifest ??
    (JSON.parse(await readFile(join(workingDir, 'manifest.json'), 'utf8')) as InkprojManifest)

  const schemaDest = await safeJoin(workingDir, manifest.schema || 'schema.mind-map')
  if (!schemaDest) throw new Error('unsafe schema path')
  await writeFile(schemaDest, payload.schema, 'utf8')

  if (payload.manifest) {
    await writeFile(
      join(workingDir, 'manifest.json'),
      JSON.stringify(payload.manifest, null, 2),
      'utf8'
    )
  }

  for (const d of payload.docs ?? []) {
    const dest = await safeJoin(workingDir, d.path)
    if (!dest) throw new Error(`unsafe doc path: ${d.path}`)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, d.content, 'utf8')
  }

  const zip = new JSZip()
  for await (const f of walkFiles(workingDir)) zip.file(f.rel, await readFile(f.abs))
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  const tmp = `${srcPath}.tmp-${Date.now().toString(36)}`
  await writeFile(tmp, buf)
  await rename(tmp, srcPath)
}

/** Remove a working directory (best-effort). */
export async function cleanupInkproj(workingDir: string): Promise<void> {
  PROJECTS.delete(workingDir)
  await rm(workingDir, { recursive: true, force: true })
}
