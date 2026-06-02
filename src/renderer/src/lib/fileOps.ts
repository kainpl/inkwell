import type { FileNode } from '@shared/ipc'
import { usePrompt } from '@renderer/store/usePrompt'
import { useAppStore } from '@renderer/store/useAppStore'
import { openPath } from './docActions'
import { baseName } from './recentFiles'
import { t } from './i18n'

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
  const name = await usePrompt.getState().ask(t('prompt.newFileName'), 'untitled.md')
  if (!name) return
  const path = await window.api.createFile(dir, name)
  notifyChanged(dir)
  await openPath(path)
}

/** Create a new folder in `dir`. */
export async function newFolder(dir: string): Promise<void> {
  const name = await usePrompt.getState().ask(t('prompt.newFolderName'), 'folder')
  if (!name) return
  await window.api.createFolder(dir, name)
  notifyChanged(dir)
}

/** Rename a file/folder; updates any open tab pointing at it (keeps unsaved edits). */
export async function renameEntry(node: FileNode): Promise<void> {
  const name = await usePrompt.getState().ask(t('prompt.rename'), node.name)
  if (!name || name === node.name) return
  const newPath = await window.api.renamePath(node.path, name)
  notifyChanged(dirOf(node.path))
  useAppStore.getState().updateTabPath(node.path, newPath, baseName(newPath))
}

/** Move a file/folder into another folder (chosen via dialog); updates open tabs. */
export async function moveEntry(node: FileNode): Promise<void> {
  const newPath = await window.api.moveToFolder(node.path)
  if (!newPath) return
  notifyChanged(dirOf(node.path))
  notifyChanged(dirOf(newPath))
  useAppStore.getState().updateTabPath(node.path, newPath, baseName(newPath))
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
