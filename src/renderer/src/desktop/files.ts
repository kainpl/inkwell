import { translate } from '@renderer/lib/i18n'
import { useAppStore } from '@renderer/store/useAppStore'
import { message, open, save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { updateRecents, type RecentKind } from '@renderer/lib/recents'
import { readDir, readFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { basename, sep } from '@tauri-apps/api/path'
import type { FileNode, OpenedFile } from '@shared/files'

const extensions = ['md', 'markdown', 'mdown', 'mkd', 'txt']

async function remember(kind: RecentKind, path: string): Promise<void> {
  try {
    await updateRecents({ type: 'visit', kind, path })
  } catch (error) {
    void message(String(error), {
      title: translate('Could not update recent items'),
      kind: 'error'
    })
  }
}

async function readDocumentText(path: string): Promise<string> {
  // Preserve an existing UTF-8 BOM on a subsequent save, as well as the line endings.
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await readFile(path))
}

async function readDocument(path: string): Promise<OpenedFile> {
  const content = await readDocumentText(path)
  await remember('files', path)
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

async function readFolder(path: string): Promise<FileNode> {
  const entries = await children(path)
  const name = await basename(path).catch(() => path) // A filesystem root has no basename.
  await remember('folders', path)
  return { path, name, type: 'directory', children: entries }
}

export const files = {
  restoreRecentAccess: (kind: RecentKind, path: string) =>
    invoke<void>('restore_recent_access', { kind, path }),
  readFolder,
  readFile: readDocument,
  readDocumentText,
  readDir: children,
  async openFileDialog(): Promise<OpenedFile | null> {
    const path = await open({
      title: translate('Open File…'),
      filters: [{ name: 'Markdown', extensions }]
    })
    return path ? readDocument(path) : null
  },
  async openFolderDialog(): Promise<FileNode | null> {
    const path = await open({ title: translate('Open Folder…'), directory: true, recursive: true })
    return path ? readFolder(path) : null
  },
  async saveFile(path: string, content: string): Promise<boolean> {
    await writeTextFile(path, content)
    return true
  },
  async saveFileAs(content: string, name: string, id: number): Promise<OpenedFile | null> {
    const path = await save({
      title: translate('Save As…'),
      defaultPath: name,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (!path) return null
    if (useAppStore.getState().tabs.some((tab) => tab.id !== id && tab.doc.path === path)) {
      throw new Error(translate('That file is already open in another tab.'))
    }
    await writeTextFile(path, content)
    await remember('files', path)
    return { path, name: await basename(path), content }
  }
}
