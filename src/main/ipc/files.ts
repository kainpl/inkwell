import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { basename, join } from 'path'
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
}
