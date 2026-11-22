import { translate } from '@renderer/lib/i18n'
import { useAppStore } from '@renderer/store/useAppStore'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readDir, readFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { basename, sep } from '@tauri-apps/api/path'
import type { FileNode, OpenedFile } from '@shared/files'

const extensions = ['md', 'markdown', 'mdown', 'mkd', 'txt']

async function readDocument(path: string): Promise<OpenedFile> {
  // Preserve an existing UTF-8 BOM on a subsequent save, as well as the line endings.
  const content = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await readFile(path))
  return { path, name: await basename(path), content }
}

async function children(path: string): Promise<FileNode[]> {
  const entries = (await readDir(path)).filter(
    (entry) =>
      !entry.name.startsWith('.') &&
      entry.name !== 'node_modules' &&
      !entry.isSymlink &&
      (entry.isDirectory || (entry.isFile && /\.(md|markdown|mdown|mkd|txt)$/i.test(entry.name)))
  )
  entries.sort(
    (a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)
  )
  const prefix = path.endsWith(sep()) ? path : path + sep()
  return entries.map((entry) => ({
    path: prefix + entry.name,
    name: entry.name,
    type: entry.isDirectory ? 'directory' : 'file'
  }))
}

export const files = {
  readFile: readDocument,
  readDir: children,
  async openFileDialog(): Promise<OpenedFile | null> {
    const path = await open({ title: translate('Open File…'), filters: [{ name: 'Markdown', extensions }] })
    return path ? readDocument(path) : null
  },
  async openFolderDialog(): Promise<FileNode | null> {
    const path = await open({ title: translate('Open Folder…'), directory: true, recursive: true })
    return path
      ? { path, name: await basename(path), type: 'directory', children: await children(path) }
      : null
  },
  async saveFile(path: string, content: string): Promise<boolean> {
    await writeTextFile(path, content)
    return true
  },
  async saveFileAs(content: string): Promise<OpenedFile | null> {
    const path = await save({
      title: translate('Save As…'),
      defaultPath: useAppStore.getState().doc.name,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (!path) return null
    await writeTextFile(path, content)
    return { path, name: await basename(path), content }
  }
}
