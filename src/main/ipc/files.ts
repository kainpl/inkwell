import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import { promises as fs, watch as fsWatch, type FSWatcher } from 'fs'
import { basename, dirname, extname, join, sep } from 'path'
import { execFile } from 'child_process'
import {
  IPC,
  type FileNode,
  type OpenedFile,
  type ArticleEntry,
  type SearchFileResult,
  type DraftEntry,
  type VersionEntry
} from '../../shared/ipc'
import { MAX_VERSIONS, shouldSnapshot, versionsToPrune } from '../../shared/versions'
import { decode } from '../../shared/encodings'

const MD_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.txt']

// The exact bytes we last wrote per path, so the disk watcher can tell our own
// saves apart from edits made by another program (and not fire a false alarm).
const lastWritten = new Map<string, string>()

function isHidden(name: string): boolean {
  return name.startsWith('.')
}

async function readDirTree(dirPath: string, depth = 0): Promise<FileNode[]> {
  // Shallow read by default; the renderer requests deeper levels on expand.
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    if (isHidden(entry.name)) continue
    if (entry.name === 'node_modules') continue

    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      nodes.push({
        path: fullPath,
        name: entry.name,
        type: 'directory',
        children: depth > 0 ? await readDirTree(fullPath, depth - 1) : undefined
      })
    } else if (MD_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      nodes.push({ path: fullPath, name: entry.name, type: 'file' })
    }
  }

  // Directories first, then files; both alphabetical.
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

export function registerFileIpc(): void {
  ipcMain.handle(IPC.openFileDialog, async (): Promise<OpenedFile | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] }]
    })
    if (canceled || filePaths.length === 0) return null
    const path = filePaths[0]
    const content = await fs.readFile(path, 'utf-8')
    return { path, name: basename(path), content }
  })

  ipcMain.handle(IPC.openFolderDialog, async (): Promise<FileNode | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    const path = filePaths[0]
    return {
      path,
      name: basename(path),
      type: 'directory',
      children: await readDirTree(path, 1)
    }
  })

  ipcMain.handle(IPC.readDir, async (_e, dirPath: string): Promise<FileNode[]> => {
    return readDirTree(dirPath, 0)
  })

  // Open a folder by path (no dialog) — used to restore the last session.
  // Returns null if the path no longer exists or isn't a directory.
  ipcMain.handle(IPC.readFolder, async (_e, dirPath: string): Promise<FileNode | null> => {
    try {
      const st = await fs.stat(dirPath)
      if (!st.isDirectory()) return null
      return {
        path: dirPath,
        name: basename(dirPath),
        type: 'directory',
        children: await readDirTree(dirPath, 1)
      }
    } catch {
      return null
    }
  })

  // Recursively collect every markdown file under `dirPath` with its mtime,
  // for the Articles list and quick-open. Skips hidden dirs and node_modules.
  ipcMain.handle(IPC.listArticles, async (_e, dirPath: string): Promise<ArticleEntry[]> => {
    const out: ArticleEntry[] = []
    async function walk(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null)
      if (!entries) return
      for (const entry of entries) {
        if (isHidden(entry.name) || entry.name === 'node_modules') continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else if (MD_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
          try {
            const st = await fs.stat(full)
            out.push({ path: full, name: entry.name, mtime: st.mtimeMs })
          } catch {
            /* ignore unreadable files */
          }
        }
      }
    }
    await walk(dirPath)
    return out
  })

  // Global search: scan every markdown file under `dirPath` for `query`,
  // returning matching lines grouped by file. Plain (case-insensitive)
  // substring match; capped to keep the UI responsive on large trees.
  ipcMain.handle(
    IPC.searchInFolder,
    async (_e, dirPath: string, query: string): Promise<SearchFileResult[]> => {
      const needle = query.toLowerCase()
      if (needle.trim() === '') return []
      const results: SearchFileResult[] = []
      let totalMatches = 0
      const MAX_MATCHES = 500

      async function walk(dir: string): Promise<void> {
        if (totalMatches >= MAX_MATCHES) return
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null)
        if (!entries) return
        for (const entry of entries) {
          if (totalMatches >= MAX_MATCHES) return
          if (isHidden(entry.name) || entry.name === 'node_modules') continue
          const full = join(dir, entry.name)
          if (entry.isDirectory()) {
            await walk(full)
          } else if (MD_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
            let content: string
            try {
              content = await fs.readFile(full, 'utf-8')
            } catch {
              continue
            }
            const fileMatches: SearchFileResult['matches'] = []
            let offset = 0
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(needle)) {
                fileMatches.push({ line: i + 1, offset, text: lines[i].trim().slice(0, 200) })
                if (++totalMatches >= MAX_MATCHES) break
              }
              offset += lines[i].length + 1
            }
            if (fileMatches.length) {
              results.push({ path: full, name: basename(full), matches: fileMatches })
            }
          }
        }
      }
      await walk(dirPath)
      return results
    }
  )

  ipcMain.handle(IPC.readFile, async (_e, path: string): Promise<OpenedFile> => {
    const content = await fs.readFile(path, 'utf-8')
    return { path, name: basename(path), content }
  })

  // Re-read a file under a specific text encoding (File → Reopen with Encoding).
  // `decode` validates the id and is non-fatal, so a wrong guess yields mojibake
  // rather than throwing. Node 18+ full-ICU handles the legacy code pages.
  ipcMain.handle(
    IPC.readFileAs,
    async (_e, path: string, encoding: string): Promise<OpenedFile> => {
      const buf = await fs.readFile(path)
      return { path, name: basename(path), content: decode(buf, encoding) }
    }
  )

  // Read the bundled welcome document, loaded as the first-launch doc. In dev it
  // sits at <project>/resources/Welcome.md (main bundles to out/main); when
  // packaged it's copied next to the app via electron-builder `extraResources`.
  ipcMain.handle(IPC.getWelcome, async (): Promise<string> => {
    const file = app.isPackaged
      ? join(process.resourcesPath, 'Welcome.md')
      : join(__dirname, '../../resources/Welcome.md')
    return fs.readFile(file, 'utf-8').catch(() => '')
  })

  ipcMain.handle(IPC.saveFile, async (_e, path: string, content: string): Promise<boolean> => {
    await fs.writeFile(path, content, 'utf-8')
    lastWritten.set(path, content)
    return true
  })

  ipcMain.handle(
    IPC.saveFileAs,
    async (e, content: string): Promise<OpenedFile | null> => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const { canceled, filePath } = await dialog.showSaveDialog(win!, {
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        defaultPath: 'untitled.md'
      })
      if (canceled || !filePath) return null
      await fs.writeFile(filePath, content, 'utf-8')
      lastWritten.set(filePath, content)
      return { path: filePath, name: basename(filePath), content }
    }
  )

  // Save a pasted/dropped image next to the document in an `assets/` folder,
  // returning the relative path to insert. Null when the doc is unsaved (the
  // renderer then falls back to embedding a data: URI).
  ipcMain.handle(
    IPC.saveImage,
    async (_e, docPath: string | null, name: string, data: Uint8Array): Promise<string | null> => {
      if (!docPath) return null
      const dir = join(dirname(docPath), 'assets')
      await fs.mkdir(dir, { recursive: true })

      // Avoid clobbering: append -1, -2, … if the name is taken.
      const ext = extname(name)
      const stem = basename(name, ext)
      let candidate = name
      let n = 1
      for (;;) {
        try {
          await fs.access(join(dir, candidate))
          candidate = `${stem}-${n++}${ext}`
        } catch {
          break
        }
      }
      await fs.writeFile(join(dir, candidate), Buffer.from(data))
      return 'assets/' + candidate
    }
  )

  // Open a file dialog to pick a local image; return its name + bytes so the
  // renderer can copy it into the document's assets/ folder (Format → Image).
  ipcMain.handle(
    IPC.pickImage,
    async (e): Promise<{ name: string; data: Uint8Array } | null> => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }
        ]
      })
      if (canceled || filePaths.length === 0) return null
      const data = await fs.readFile(filePaths[0])
      return { name: basename(filePaths[0]), data }
    }
  )

  // Upload an image via a user-configured shell command (Typora-style). The
  // command runs with the absolute file path appended as the last argument and
  // must print the resulting URL to stdout. Returns the trimmed URL, or throws.
  ipcMain.handle(
    IPC.uploadImage,
    async (_e, command: string, filePath: string): Promise<string> => {
      if (!command.trim()) throw new Error('No image upload command configured')
      const parts = command.trim().split(/\s+/)
      const exe = parts[0]
      const args = [...parts.slice(1), filePath]
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(exe, args, { timeout: 60_000 }, (err, out, errOut) => {
          if (err) reject(new Error(errOut || err.message))
          else resolve(out)
        })
      })
      const url = stdout.trim().split(/\r?\n/).pop()?.trim() ?? ''
      if (!/^https?:\/\//i.test(url)) throw new Error('Upload command did not return a URL')
      return url
    }
  )

  // --- File-tree mutations -------------------------------------------------

  /** Return a path under `dir` for `name` that doesn't collide (adds " 2", …). */
  async function uniquePath(dir: string, name: string): Promise<string> {
    const ext = extname(name)
    const stem = basename(name, ext)
    let candidate = name
    let n = 2
    for (;;) {
      try {
        await fs.access(join(dir, candidate))
        candidate = `${stem} ${n++}${ext}`
      } catch {
        return join(dir, candidate)
      }
    }
  }

  ipcMain.handle(IPC.createFile, async (_e, dirPath: string, name: string): Promise<string> => {
    const path = await uniquePath(dirPath, name)
    await fs.writeFile(path, '', 'utf-8')
    return path
  })

  ipcMain.handle(IPC.createFolder, async (_e, dirPath: string, name: string): Promise<string> => {
    const path = await uniquePath(dirPath, name)
    await fs.mkdir(path)
    return path
  })

  ipcMain.handle(IPC.renamePath, async (_e, oldPath: string, newName: string): Promise<string> => {
    const target = join(dirname(oldPath), newName)
    await fs.rename(oldPath, target)
    return target
  })

  // Move a file/folder into a folder chosen via a dialog. Returns the new path,
  // or null if canceled / the destination is the same folder or inside itself.
  ipcMain.handle(IPC.moveToFolder, async (e, srcPath: string): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Move to folder…',
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    const destDir = filePaths[0]
    // No-op for the same folder; reject moving a folder into itself/its subtree.
    if (destDir === dirname(srcPath)) return null
    if (destDir === srcPath || destDir.startsWith(srcPath + sep)) return null
    const target = await uniquePath(destDir, basename(srcPath))
    await fs.rename(srcPath, target)
    return target
  })

  ipcMain.handle(IPC.duplicateFile, async (_e, path: string): Promise<string> => {
    const ext = extname(path)
    const stem = basename(path, ext)
    const target = await uniquePath(dirname(path), `${stem} copy${ext}`)
    await fs.copyFile(path, target)
    return target
  })

  // Move to OS trash (recoverable), not a hard delete.
  ipcMain.handle(IPC.deletePath, async (_e, path: string): Promise<boolean> => {
    await shell.trashItem(path)
    return true
  })

  ipcMain.handle(IPC.revealPath, async (_e, path: string): Promise<void> => {
    shell.showItemInFolder(path)
  })

  // --- Crash-recovery drafts (snapshots under userData/drafts) -------------
  const draftsDir = (): string => join(app.getPath('userData'), 'drafts')

  // The draft id becomes a filename, so it must never contain path separators
  // or traversal sequences (it arrives over IPC and cannot be trusted).
  const draftFile = (dir: string, id: string): string => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('invalid draft id')
    return join(dir, id + '.json')
  }

  // Save a draft snapshot keyed by id; the meta (path/name) rides in the file.
  ipcMain.handle(IPC.saveDraft, async (_e, draft: DraftEntry): Promise<boolean> => {
    const dir = draftsDir()
    const file = draftFile(dir, draft.id)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(file, JSON.stringify(draft), 'utf-8')
    return true
  })

  // List all saved drafts (unreadable/corrupt files are skipped).
  ipcMain.handle(IPC.listDrafts, async (): Promise<DraftEntry[]> => {
    const dir = draftsDir()
    let names: string[]
    try {
      names = await fs.readdir(dir)
    } catch {
      return []
    }
    const out: DraftEntry[] = []
    for (const n of names) {
      if (!n.endsWith('.json')) continue
      try {
        out.push(JSON.parse(await fs.readFile(join(dir, n), 'utf-8')) as DraftEntry)
      } catch {
        /* skip corrupt draft */
      }
    }
    return out
  })

  // Remove a draft once its document has been cleanly saved or discarded.
  ipcMain.handle(IPC.clearDraft, async (_e, id: string): Promise<boolean> => {
    let file: string
    try {
      file = draftFile(draftsDir(), id) // rejects ids with path separators
    } catch {
      return false
    }
    try {
      await fs.unlink(file)
    } catch {
      /* already gone */
    }
    return true
  })

  // --- Local version history (snapshots under userData/versions/<id>) ------
  // The id arrives over IPC and becomes a folder name, so it can't be trusted.
  const versionDir = (id: string): string => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('invalid version id')
    return join(app.getPath('userData'), 'versions', id)
  }

  // Read the timestamp stems of a doc's snapshots, newest first.
  const versionStems = async (dir: string): Promise<number[]> => {
    const names = await fs.readdir(dir).catch(() => [] as string[])
    return names
      .filter((n) => n.endsWith('.md'))
      .map((n) => Number(basename(n, '.md')))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)
  }

  // Snapshot the saved content as a new version, unless it duplicates the most
  // recent one; prune the oldest beyond MAX_VERSIONS. Returns true if written.
  ipcMain.handle(IPC.saveVersion, async (_e, id: string, content: string): Promise<boolean> => {
    let dir: string
    try {
      dir = versionDir(id)
    } catch {
      return false
    }
    await fs.mkdir(dir, { recursive: true })
    const stems = await versionStems(dir)
    const latest =
      stems.length > 0
        ? await fs.readFile(join(dir, `${stems[0]}.md`), 'utf-8').catch(() => null)
        : null
    if (!shouldSnapshot(content, latest)) return false

    await fs.writeFile(join(dir, `${Date.now()}.md`), content, 'utf-8')

    const after = await versionStems(dir)
    for (const stem of versionsToPrune(after, MAX_VERSIONS)) {
      await fs.unlink(join(dir, `${stem}.md`)).catch(() => undefined)
    }
    return true
  })

  // List a document's saved versions (newest first), each with its size.
  ipcMain.handle(IPC.listVersions, async (_e, id: string): Promise<VersionEntry[]> => {
    let dir: string
    try {
      dir = versionDir(id)
    } catch {
      return []
    }
    const stems = await versionStems(dir)
    const out: VersionEntry[] = []
    for (const savedAt of stems) {
      const st = await fs.stat(join(dir, `${savedAt}.md`)).catch(() => null)
      out.push({ savedAt, size: st ? st.size : 0 })
    }
    return out
  })

  // Read back the content of one specific version.
  ipcMain.handle(
    IPC.readVersion,
    async (_e, id: string, savedAt: number): Promise<string | null> => {
      let dir: string
      try {
        dir = versionDir(id)
      } catch {
        return null
      }
      if (!Number.isFinite(savedAt)) return null
      return fs.readFile(join(dir, `${Math.trunc(savedAt)}.md`), 'utf-8').catch(() => null)
    }
  )

  // --- Disk watcher: notify the renderer when the open file changes outside --
  let watcher: FSWatcher | null = null
  let watchedPath: string | null = null
  let watchTimer: ReturnType<typeof setTimeout> | null = null

  const stopWatch = (): void => {
    if (watcher) {
      watcher.close()
      watcher = null
    }
    if (watchTimer) {
      clearTimeout(watchTimer)
      watchTimer = null
    }
    watchedPath = null
  }

  // Watch a single path for the calling window. Passing null (or a new path)
  // stops the previous watch. fs.watch fires in bursts, so we debounce, then
  // diff against `lastWritten` to ignore the event caused by our own save.
  const armWatch = (path: string, wc: Electron.WebContents): void => {
    try {
      watcher = fsWatch(path, () => {
        if (watchTimer) clearTimeout(watchTimer)
        watchTimer = setTimeout(() => void onChange(path, wc), 150)
      })
    } catch {
      /* file may not exist yet (unsaved doc) — nothing to watch */
    }
  }

  const onChange = async (path: string, wc: Electron.WebContents): Promise<void> => {
    if (watchedPath !== path || wc.isDestroyed()) return
    let content: string
    try {
      content = await fs.readFile(path, 'utf-8')
    } catch {
      if (!wc.isDestroyed()) wc.send(IPC.fileRemovedExternally)
      return
    }
    // Re-arm: an atomic save (write-temp + rename over) can invalidate the
    // original handle after one event, so re-establish the watch each time.
    if (watcher) {
      watcher.close()
      watcher = null
    }
    armWatch(path, wc)
    if (content === lastWritten.get(path)) return // our own save
    if (!wc.isDestroyed()) wc.send(IPC.fileChangedExternally, content)
  }

  ipcMain.handle(IPC.watchFile, (e, path: string | null): void => {
    stopWatch()
    if (!path) return
    watchedPath = path
    armWatch(path, e.sender)
  })
}
