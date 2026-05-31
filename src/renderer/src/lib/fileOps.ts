import type { FileNode } from '@shared/ipc'
import { usePrompt } from '@renderer/store/usePrompt'
import { useAppStore } from '@renderer/store/useAppStore'
import { openPath } from './docActions'
import { baseName } from './recentFiles'

/** Dispatched after a tree mutation; detail is the affected directory path. */
export const TREE_CHANGED = 'ink:tree-changed'

function dirOf(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i >= 0 ? path.slice(0, i) : path
}

function notifyChanged(dir: string): void {
  window.dispatchEvent(new CustomEvent(TREE_CHANGED, { detail: dir }))
}

/** Create a new markdown file in `dir`, then open it. */
export async function newFile(dir: string): Promise<void> {
  const name = await usePrompt.getState().ask('New file name', 'untitled.md')
  if (!name) return
  const path = await window.api.createFile(dir, name)
  notifyChanged(dir)
  await openPath(path)
}

/** Create a new folder in `dir`. */
export async function newFolder(dir: string): Promise<void> {
  const name = await usePrompt.getState().ask('New folder name', 'folder')
  if (!name) return
  await window.api.createFolder(dir, name)
  notifyChanged(dir)
}

/** Rename a file/folder; updates the open document if it was the renamed file. */
export async function renameEntry(node: FileNode): Promise<void> {
  const name = await usePrompt.getState().ask('Rename', node.name)
  if (!name || name === node.name) return
  const newPath = await window.api.renamePath(node.path, name)
  notifyChanged(dirOf(node.path))
  const doc = useAppStore.getState().doc
  if (doc.path === node.path) {
    useAppStore.getState().loadDoc({ path: newPath, name: baseName(newPath), content: doc.content })
  }
}

/** Duplicate a file (adds " copy"). */
export async function duplicateEntry(node: FileNode): Promise<void> {
  await window.api.duplicateFile(node.path)
  notifyChanged(dirOf(node.path))
}

/** Move a file/folder to the OS trash (recoverable from the system trash). */
export async function deleteEntry(node: FileNode): Promise<void> {
  await window.api.deletePath(node.path)
  notifyChanged(dirOf(node.path))
}

/** Reveal a file/folder in the OS file manager. */
export async function revealEntry(node: FileNode): Promise<void> {
  await window.api.revealPath(node.path)
}
