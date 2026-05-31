import { addRecent, removeRecent } from './recentFiles'

/**
 * Renderer-side persistence (localStorage) for the recent-files list and the
 * last session (so the app can reopen your last folder/file on launch).
 */

const RECENT_KEY = 'inkwell.recentFiles'
const SESSION_KEY = 'inkwell.session'

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

export function getSession(): Session {
  return read<Session>(SESSION_KEY, { filePath: null, folderPath: null })
}

export function setSessionFile(filePath: string | null): void {
  write(SESSION_KEY, { ...getSession(), filePath })
}

export function setSessionFolder(folderPath: string | null): void {
  write(SESSION_KEY, { ...getSession(), folderPath })
}
