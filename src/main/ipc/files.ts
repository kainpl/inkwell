import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { promises as fs } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { execFile } from 'child_process'
import {
  IPC,
  type FileNode,
  type OpenedFile,
  type ArticleEntry,
  type SearchFileResult
} from '../../shared/ipc'

const MD_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.txt']

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

  ipcMain.handle(IPC.saveFile, async (_e, path: string, content: string): Promise<boolean> => {
    await fs.writeFile(path, content, 'utf-8')
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
}
