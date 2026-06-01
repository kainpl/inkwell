import { addRecent, removeRecent } from './recentFiles'

/**
 * Renderer-side persistence (localStorage) for the recent-files list and the
 * last session (so the app can reopen your last folder/file on launch).
 */

const RECENT_KEY = 'inkwell.recentFiles'
const RECENT_FOLDERS_KEY = 'inkwell.recentFolders'
const SESSION_KEY = 'inkwell.session'
const CARET_KEY = 'inkwell.caret'
/** Max remembered caret positions before the oldest are evicted. */
const CARET_CAP = 200

export interface Session {
  /** Last opened document path (null for an unsaved/Untitled doc). */
  filePath: string | null
  /** Last opened folder path (root of the file tree). */
  folderPath: string | null
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable / quota — non-fatal */
  }
}

export function getRecentFiles(): string[] {
  return read<string[]>(RECENT_KEY, [])
}

export function pushRecentFile(path: string): string[] {
  const next = addRecent(getRecentFiles(), path)
  write(RECENT_KEY, next)
  return next
}

export function dropRecentFile(path: string): string[] {
  const next = removeRecent(getRecentFiles(), path)
  write(RECENT_KEY, next)
  return next
}

export function clearRecentFiles(): void {
  write(RECENT_KEY, [])
}

export function getRecentFolders(): string[] {
  return read<string[]>(RECENT_FOLDERS_KEY, [])
}

export function pushRecentFolder(path: string): string[] {
  const next = addRecent(getRecentFolders(), path)
  write(RECENT_FOLDERS_KEY, next)
  return next
}

export function dropRecentFolder(path: string): string[] {
  const next = removeRecent(getRecentFolders(), path)
  write(RECENT_FOLDERS_KEY, next)
  return next
}

export function clearRecentFolders(): void {
  write(RECENT_FOLDERS_KEY, [])
}

export function getSession(): Session {
  return read<Session>(SESSION_KEY, { filePath: null, folderPath: null })
}

export function setSessionFile(filePath: string | null): void {
  write(SESSION_KEY, { ...getSession(), filePath })
}

export function setSessionFolder(folderPath: string | null): void {
  write(SESSION_KEY, { ...getSession(), folderPath })
}

/** Remembered caret offset for a file path, to restore on reopen. */
export function getCaret(path: string): number | undefined {
  return read<Record<string, number>>(CARET_KEY, {})[path]
}

/** Remember the caret offset for a file path (evicts oldest beyond the cap). */
export function setCaret(path: string, offset: number): void {
  const map = read<Record<string, number>>(CARET_KEY, {})
  // Re-insert at the end so recently-used paths survive eviction.
  delete map[path]
  map[path] = offset
  const keys = Object.keys(map)
  for (const k of keys.slice(0, Math.max(0, keys.length - CARET_CAP))) delete map[k]
  write(CARET_KEY, map)
}
