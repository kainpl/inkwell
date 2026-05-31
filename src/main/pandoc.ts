import { app, net } from 'electron'
import { promises as fs, createWriteStream } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'

/**
 * On-demand pandoc: resolve a usable pandoc (PATH or a binary we cached in
 * userData), and download it from the official GitHub releases when missing.
 * Archives are unpacked with the system `tar` (bsdtar handles both zip and
 * tar.gz on Win10+/macOS/Linux), so no extraction dependency is needed.
 */

const BIN = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc'

function cachedPath(): string {
  return join(app.getPath('userData'), 'pandoc', BIN)
}

/** Whether `bin` runs (`pandoc --version` succeeds). */
function canRun(bin: string): Promise<boolean> {
  return new Promise((resolve) => execFile(bin, ['--version'], (err) => resolve(!err)))
}

/** A usable pandoc command (PATH or our cached binary), or null. No download. */
export async function resolvePandoc(): Promise<string | null> {
  if (await canRun('pandoc')) return 'pandoc'
  const cached = cachedPath()
  if (await canRun(cached)) return cached
  return null
}

/** Run pandoc (resolved binary) with args; rejects with stderr on failure. */
export function runPandoc(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 120_000 }, (err, _out, errOut) => {
      if (err) reject(new Error(errOut || err.message))
      else resolve()
    })
  })
}

/** GitHub release asset name pattern for the current platform/arch. */
export function assetPattern(platform: NodeJS.Platform, arch: string): RegExp {
  if (platform === 'win32') return /windows-x86_64\.zip$/
  if (platform === 'darwin') return arch === 'arm64' ? /arm64-macOS\.zip$/ : /x86_64-macOS\.zip$/
  return arch === 'arm64' ? /linux-arm64\.tar\.gz$/ : /linux-amd64\.tar\.gz$/
}

interface Asset {
  name: string
  browser_download_url: string
}

/** Find the pandoc release asset for this platform from the latest release. */
async function findAsset(): Promise<Asset | null> {
  const res = await net.fetch('https://api.github.com/repos/jgm/pandoc/releases/latest', {
    headers: { 'User-Agent': 'Inkwell', Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) return null
  const json = (await res.json()) as { assets: Asset[] }
  const pat = assetPattern(process.platform, process.arch)
  return json.assets.find((a) => pat.test(a.name)) ?? null
}

/** Download `url` to `dest`, reporting 0–100% progress. */
async function download(url: string, dest: string, onProgress: (pct: number) => void): Promise<void> {
  const res = await net.fetch(url, { headers: { 'User-Agent': 'Inkwell' } })
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`)
  const total = Number(res.headers.get('content-length')) || 0
  const out = createWriteStream(dest)
  const reader = res.body.getReader()
  let received = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      out.write(Buffer.from(value))
      received += value.length
      if (total) onProgress(Math.min(99, Math.round((received / total) * 100)))
    }
  } finally {
    await new Promise<void>((r) => out.end(r))
  }
}

/** Recursively find a file named `name` under `dir`. */
async function findFile(dir: string, name: string): Promise<string | null> {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) {
      const f = await findFile(p, name)
      if (f) return f
    } else if (ent.name === name) {
      return p
    }
  }
  return null
}

function untar(archive: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('tar', ['-xf', archive, '-C', dest], (err, _o, e) =>
      err ? reject(new Error(e || err.message)) : resolve()
    )
  })
}

/**
 * Ensure pandoc is available, downloading + caching it on demand. `onProgress`
 * gets 0–100 during download (100 = done). Returns the usable binary or null.
 */
export async function downloadPandoc(onProgress: (pct: number) => void): Promise<string | null> {
  const asset = await findAsset()
  if (!asset) return null

  const archive = join(app.getPath('temp'), asset.name)
  const extractDir = join(app.getPath('temp'), `inkwell-pandoc-${Date.now()}`)
  try {
    onProgress(0)
    await download(asset.browser_download_url, archive, onProgress)
    await fs.mkdir(extractDir, { recursive: true })
    await untar(archive, extractDir)

    const src = await findFile(extractDir, BIN)
    if (!src) return null
    const destDir = join(app.getPath('userData'), 'pandoc')
    await fs.mkdir(destDir, { recursive: true })
    const dest = cachedPath()
    await fs.copyFile(src, dest)
    if (process.platform !== 'win32') await fs.chmod(dest, 0o755)
    onProgress(100)
    return (await canRun(dest)) ? dest : null
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => undefined)
    await fs.unlink(archive).catch(() => undefined)
  }
}
