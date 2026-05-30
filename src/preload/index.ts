import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type FileNode, type OpenedFile } from '../shared/ipc'

const menuChannels = [
  IPC.menuNewFile,
  IPC.menuOpenFile,
  IPC.menuOpenFolder,
  IPC.menuSave,
  IPC.menuSaveAs,
  IPC.menuToggleSidebar,
  IPC.menuToggleOutline,
  IPC.menuToggleFocusMode,
  IPC.menuToggleFormatBar
] as const

type MenuChannel = (typeof menuChannels)[number]

const api = {
  openFileDialog: (): Promise<OpenedFile | null> => ipcRenderer.invoke(IPC.openFileDialog),
  openFolderDialog: (): Promise<FileNode | null> => ipcRenderer.invoke(IPC.openFolderDialog),
  readDir: (path: string): Promise<FileNode[]> => ipcRenderer.invoke(IPC.readDir, path),
  readFile: (path: string): Promise<OpenedFile> => ipcRenderer.invoke(IPC.readFile, path),
  saveFile: (path: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.saveFile, path, content),
  saveFileAs: (content: string): Promise<OpenedFile | null> =>
    ipcRenderer.invoke(IPC.saveFileAs, content),

  /** Tell the main process whether the document has unsaved changes. */
  setDirty: (dirty: boolean): void => ipcRenderer.send(IPC.setDirty, dirty),
  /** Ask the main process to close the window (after the guard has passed). */
  closeWindow: (): void => ipcRenderer.send(IPC.closeWindow),
  /** Main asks the renderer to handle a close attempt (run the unsaved guard). */
  onTryClose: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IPC.tryClose, listener)
    return () => ipcRenderer.removeListener(IPC.tryClose, listener)
  },

  /** Subscribe to Format-menu commands; handler receives the action id. */
  onFormat: (handler: (action: string) => void): (() => void) => {
    const listener = (_e: unknown, action: string): void => handler(action)
    ipcRenderer.on(IPC.menuFormat, listener)
    return () => ipcRenderer.removeListener(IPC.menuFormat, listener)
  },

  /** Subscribe to a menu command coming from the main process. Returns an unsubscribe fn. */
  onMenu: (channel: MenuChannel, handler: () => void): (() => void) => {
    // Guard against unexpected channels (also keeps `menuChannels` a runtime value).
    if (!menuChannels.includes(channel)) return () => undefined
    const listener = (): void => handler()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type InkwellApi = typeof api
