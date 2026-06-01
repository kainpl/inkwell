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

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut'

interface RawFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  /** Present for shortcuts (e.g. "shared with me" items added to My Drive). */
  shortcutDetails?: { targetId?: string; targetMimeType?: string }
}

/**
 * Map a Drive `files.list` payload to sorted nodes (folders first, then name).
 * Shortcuts are transparently resolved to the object they point at — the
 * shortcut's display name is kept, but its id/type come from the target, so
 * expanding/opening acts on the real file or folder.
 */
export function mapDriveFiles(files: RawFile[]): DriveNode[] {
  return files
    .map((f) => {
      const sc = f.mimeType === SHORTCUT_MIME ? f.shortcutDetails : undefined
      const id = sc?.targetId || f.id
      const mimeType = sc ? sc.targetMimeType || '' : f.mimeType
      return {
        id,
        name: f.name,
        type: mimeType === FOLDER_MIME ? ('directory' as const) : ('file' as const),
        mimeType,
        modifiedTime: f.modifiedTime ?? ''
      }
    })
    .sort((a, b) =>
      a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name.localeCompare(b.name)
    )
}

/** True for Google-native docs (Docs/Sheets/…) that aren't raw text in v1. */
export function isGoogleDoc(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.') && mimeType !== FOLDER_MIME
}

/** True when the remote file changed since we loaded `base` (both RFC-3339).
 *  An empty/unknown time on either side never blocks. */
export function isConflict(base: string, remote: string): boolean {
  if (!remote || !base) return false
  return new Date(remote).getTime() > new Date(base).getTime()
}
