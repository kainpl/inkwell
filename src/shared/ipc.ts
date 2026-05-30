/**
 * Shared contract between the main and renderer processes.
 * Keep this file dependency-free so it can be imported from any process.
 */

export interface FileNode {
  /** Absolute path on disk */
  path: string
  /** Display name (basename) */
  name: string
  /** Directory vs file */
  type: 'file' | 'directory'
  /** Populated lazily for directories */
  children?: FileNode[]
}

export interface OpenedFile {
  path: string
  name: string
  content: string
}

/** IPC channel names. One source of truth for both sides. */
export const IPC = {
  // renderer -> main (invoke/handle)
  openFileDialog: 'dialog:openFile',
  openFolderDialog: 'dialog:openFolder',
  readFile: 'fs:readFile',
  saveFile: 'fs:saveFile',
  saveFileAs: 'fs:saveFileAs',
  readDir: 'fs:readDir',
  saveImage: 'fs:saveImage',
  uploadImage: 'fs:uploadImage',
  // main -> renderer (send/on)
  menuNewFile: 'menu:newFile',
  menuOpenFile: 'menu:openFile',
  menuOpenFolder: 'menu:openFolder',
  menuSave: 'menu:save',
  menuSaveAs: 'menu:saveAs',
  menuToggleSidebar: 'menu:toggleSidebar',
  menuToggleOutline: 'menu:toggleOutline',
  menuToggleFocusMode: 'menu:toggleFocusMode',
  menuToggleFormatBar: 'menu:toggleFormatBar',
  menuFormat: 'menu:format',
  // app lifecycle / unsaved-changes guard
  setDirty: 'app:setDirty',
  closeWindow: 'app:closeWindow',
  tryClose: 'app:tryClose'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
