import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { execFile } from 'child_process'
import { IPC, type FileNode, type OpenedFile } from '../../shared/ipc'

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
}
