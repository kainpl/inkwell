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
