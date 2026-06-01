/**
 * Pure, renderer-safe Google Drive helpers and types. MUST NOT import any
 * Node built-ins (this module is bundled into the renderer). Crypto-dependent
 * PKCE lives in `./pkce` (main-only).
 */

/** A connected Google account, as seen by the renderer (no tokens). */
export interface DriveAccount {
  accountId: string
  email: string
}

/** One entry in a Drive folder listing. */
export interface DriveNode {
  id: string
  name: string
  type: 'file' | 'directory'
  mimeType: string
  /** RFC-3339 modified time (for conflict detection); '' when unknown. */
  modifiedTime: string
}

/** A document location: a local path, or a Drive file. */
export type FileRef =
  | { provider: 'local'; path: string | null }
  | { provider: 'gdrive'; accountId: string; fileId: string }

const GDRIVE = /^gdrive:\/\/([^/]+)\/(.+)$/

/** Build the opaque doc-path URI for a Drive file. */
export function gdriveRef(accountId: string, fileId: string): string {
  return `gdrive://${accountId}/${fileId}`
}

/** Classify a doc path as a local path or a Drive file. */
export function parseRef(path: string | null): FileRef {
  if (path) {
    const m = GDRIVE.exec(path)
    if (m) return { provider: 'gdrive', accountId: m[1], fileId: m[2] }
  }
  return { provider: 'local', path }
}

/** True when a doc path points at Google Drive. */
export function isGdrive(path: string | null): boolean {
  return parseRef(path).provider === 'gdrive'
}
