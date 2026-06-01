import { net } from 'electron'
import { mapDriveFiles, type DriveNode } from '../../shared/drive'

/**
 * Thin Google Drive v3 REST client. Every call takes a valid access token
 * (the DriveService refreshes it). Uses Electron's `net.fetch`.
 */

const BASE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

const auth = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` })

interface RawFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
}

/** List a folder's children (folders first, then name), following paging. */
export async function list(token: string, folderId: string): Promise<DriveNode[]> {
  const files: RawFile[] = []
  let pageToken = ''
  do {
    const u = new URL(`${BASE}/files`)
    u.searchParams.set('q', `'${folderId}' in parents and trashed=false`)
    u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,modifiedTime)')
    u.searchParams.set('pageSize', '200')
    if (pageToken) u.searchParams.set('pageToken', pageToken)
    const r = await net.fetch(u.toString(), { headers: auth(token) })
    if (!r.ok) throw new Error(`list ${r.status}: ${await r.text()}`)
    const j = (await r.json()) as { files?: RawFile[]; nextPageToken?: string }
    files.push(...(j.files ?? []))
    pageToken = j.nextPageToken ?? ''
  } while (pageToken)
  return mapDriveFiles(files)
}

/** Read a file's raw text content. */
export async function read(token: string, fileId: string): Promise<string> {
  const r = await net.fetch(`${BASE}/files/${fileId}?alt=media`, { headers: auth(token) })
  if (!r.ok) throw new Error(`read ${r.status}: ${await r.text()}`)
  return r.text()
}

/** Fetch lightweight metadata (modifiedTime) for conflict detection. */
export async function meta(token: string, fileId: string): Promise<{ modifiedTime: string; name: string }> {
  const r = await net.fetch(`${BASE}/files/${fileId}?fields=id,name,modifiedTime`, { headers: auth(token) })
  if (!r.ok) throw new Error(`meta ${r.status}: ${await r.text()}`)
  return r.json() as Promise<{ modifiedTime: string; name: string }>
}

/** Overwrite a file's content; returns the new modifiedTime. */
export async function write(token: string, fileId: string, content: string): Promise<{ modifiedTime: string }> {
  const r = await net.fetch(`${UPLOAD}/files/${fileId}?uploadType=media&fields=modifiedTime`, {
    method: 'PATCH',
    headers: { ...auth(token), 'content-type': 'text/markdown' },
    body: content
  })
  if (!r.ok) throw new Error(`write ${r.status}: ${await r.text()}`)
  return r.json() as Promise<{ modifiedTime: string }>
}

/** Create a new markdown file in a folder; returns its node. */
export async function create(
  token: string,
  parentId: string,
  name: string,
  content: string
): Promise<DriveNode> {
  const boundary = 'inkwell-' + Math.abs(hash(name + parentId)).toString(36)
  const metadata = JSON.stringify({ name, parents: [parentId], mimeType: 'text/markdown' })
  const body =
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\ncontent-type: text/markdown\r\n\r\n${content}\r\n--${boundary}--`
  const r = await net.fetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime`, {
    method: 'POST',
    headers: { ...auth(token), 'content-type': `multipart/related; boundary=${boundary}` },
    body
  })
  if (!r.ok) throw new Error(`create ${r.status}: ${await r.text()}`)
  return mapDriveFiles([(await r.json()) as RawFile])[0]
}

/** Deterministic small hash for a stable multipart boundary (no Math.random). */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
