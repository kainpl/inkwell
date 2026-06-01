# Google Drive Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Inkwell connect to one or more Google accounts and read/write Markdown files on Google Drive, each account browsable as a root in the Files sidebar.

**Architecture:** All Drive/OAuth/token logic lives in the main process (renderer never sees tokens) behind `window.api.drive.*` IPC. A Drive file is identified by a `gdrive://<accountId>/<fileId>` URI placed in the existing `doc.path`, so tabs/recent/session/drafts keep working unchanged; only disk-touching code branches on the provider. OAuth is Authorization Code + PKCE with a loopback redirect and the system browser; refresh tokens are encrypted with `safeStorage`.

**Tech Stack:** Electron 33 (`safeStorage`, `net.fetch`, `shell.openExternal`), Node `http` (loopback), TypeScript, React 18 + Zustand, Vitest. No new runtime dependency (hand-rolled OAuth/REST).

**Spec:** `docs/superpowers/specs/2026-06-01-google-drive-integration-design.md`

**Branch:** `feat/google-drive`

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/shared/drive.ts` | Pure: types (`DriveNode`, `DriveAccount`), `gdriveRef`/`parseRef`, `mapDriveFiles`, PKCE helpers, `isConflict` |
| `src/shared/drive.test.ts` | Unit tests for the above |
| `src/main/drive/accounts.ts` | Persist accounts to `userData/drive-accounts.json`; encrypt/decrypt refresh tokens via `safeStorage` |
| `src/main/drive/oauth.ts` | PKCE auth-code flow: loopback server, system browser, token exchange + refresh |
| `src/main/drive/api.ts` | Drive v3 REST client (`list/read/write/create/meta`) + `withAuth`, `net.fetch`-based |
| `src/main/drive/index.ts` | `DriveService` tying accounts+oauth+api together (in-memory access tokens) |
| `src/main/ipc/drive.ts` | `registerDriveIpc()` — IPC handlers delegating to `DriveService` |
| `src/shared/ipc.ts` | Add `drive:*` channel names + shared types (modify) |
| `src/preload/index.ts` | Add `window.api.drive.*` surface (modify) |
| `src/main/index.ts` | `registerDriveIpc()` call (modify) |
| `src/renderer/src/store/useAppStore.ts` | `driveAccounts` state + actions (modify) |
| `src/renderer/src/lib/fileSource.ts` | `readRef`/`writeRef` dispatch (local fs vs Drive) |
| `src/renderer/src/lib/drive.ts` | Renderer actions: connect, listChildren, openDriveFile, disconnect, refreshAccounts |
| `src/renderer/src/lib/docActions.ts` | Route open/save through `fileSource` for `gdrive:` paths (modify) |
| `src/renderer/src/components/FileTree.tsx` | Render Cloud accounts as roots + lazy children + open (modify) |
| `src/renderer/src/components/DriveConnect.tsx` | "Waiting for sign-in…" modal + connect entry |
| `src/renderer/src/components/PreferencesModal.tsx` | Cloud pane: accounts, disconnect, BYO client id (modify) |
| `docs/google-drive-setup.md` | Maintainer guide to create the Google Cloud OAuth client |

---

## Phase 0 — Pure shared layer (TDD)

### Task 1: Drive URI helpers + types

**Files:**
- Create: `src/shared/drive.ts`
- Test: `src/shared/drive.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/drive.test.ts
import { gdriveRef, parseRef } from './drive'

describe('drive refs', () => {
  it('builds a gdrive uri', () => {
    expect(gdriveRef('acc1', 'file9')).toBe('gdrive://acc1/file9')
  })

  it('parses a gdrive uri', () => {
    expect(parseRef('gdrive://acc1/file9')).toEqual({
      provider: 'gdrive',
      accountId: 'acc1',
      fileId: 'file9'
    })
  })

  it('treats anything else as a local path', () => {
    expect(parseRef('D:/notes/a.md')).toEqual({ provider: 'local', path: 'D:/notes/a.md' })
    expect(parseRef(null)).toEqual({ provider: 'local', path: null })
  })

  it('round-trips ids containing no slashes', () => {
    const ref = gdriveRef('1085…sub', '1a2B_xYz')
    expect(parseRef(ref)).toMatchObject({ accountId: '1085…sub', fileId: '1a2B_xYz' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/drive.test.ts`
Expected: FAIL — cannot find module './drive'

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/drive.ts
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
  /** RFC-3339 modified time (for conflict detection). */
  modifiedTime: string
}

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/drive.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/drive.ts src/shared/drive.test.ts
git commit -m "Drive: pure URI helpers (gdriveRef/parseRef) + types"
```

### Task 2: Map Drive API list responses to nodes

**Files:**
- Modify: `src/shared/drive.ts`
- Test: `src/shared/drive.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// add to src/shared/drive.test.ts
import { mapDriveFiles } from './drive'

describe('mapDriveFiles', () => {
  const files = [
    { id: 'd1', name: 'Notes', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-01-01T00:00:00Z' },
    { id: 'f1', name: 'a.md', mimeType: 'text/markdown', modifiedTime: '2026-01-02T00:00:00Z' },
    { id: 'f2', name: 'b.txt', mimeType: 'text/plain', modifiedTime: '2026-01-03T00:00:00Z' }
  ]

  it('marks folders vs files and sorts folders-first then by name', () => {
    const nodes = mapDriveFiles(files)
    expect(nodes.map((n) => [n.name, n.type])).toEqual([
      ['Notes', 'directory'],
      ['a.md', 'file'],
      ['b.txt', 'file']
    ])
  })

  it('tolerates a missing modifiedTime', () => {
    expect(mapDriveFiles([{ id: 'x', name: 'x', mimeType: 'text/markdown' }])[0].modifiedTime).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/drive.test.ts`
Expected: FAIL — `mapDriveFiles` is not a function

- [ ] **Step 3: Write minimal implementation**

```ts
// add to src/shared/drive.ts
const FOLDER_MIME = 'application/vnd.google-apps.folder'

interface RawFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
}

/** Map a Drive `files.list` payload to sorted nodes (folders first, then name). */
export function mapDriveFiles(files: RawFile[]): DriveNode[] {
  return files
    .map((f) => ({
      id: f.id,
      name: f.name,
      type: f.mimeType === FOLDER_MIME ? ('directory' as const) : ('file' as const),
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime ?? ''
    }))
    .sort((a, b) =>
      a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name.localeCompare(b.name)
    )
}

/** True for Google-native docs (Docs/Sheets/…) that aren't raw text in v1. */
export function isGoogleDoc(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.') && mimeType !== FOLDER_MIME
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/drive.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/drive.ts src/shared/drive.test.ts
git commit -m "Drive: map list responses to sorted DriveNodes"
```

### Task 3: PKCE helpers + conflict check

**Files:**
- Modify: `src/shared/drive.ts`
- Test: `src/shared/drive.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// add to src/shared/drive.test.ts
import { pkceChallenge, isConflict } from './drive'
import { createHash } from 'node:crypto'

describe('pkceChallenge', () => {
  it('derives a base64url S256 challenge from the verifier', () => {
    const verifier = 'abc123XYZ-_~.'
    const expected = createHash('sha256').update(verifier).digest('base64url')
    expect(pkceChallenge(verifier)).toBe(expected)
    expect(pkceChallenge(verifier)).not.toMatch(/[+/=]/) // base64url, no padding
  })
})

describe('isConflict', () => {
  it('flags a remote change since the doc was loaded', () => {
    expect(isConflict('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(true)
    expect(isConflict('2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(false)
    expect(isConflict('2026-01-02T00:00:00Z', '')).toBe(false) // unknown remote → don't block
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/drive.test.ts`
Expected: FAIL — `pkceChallenge` is not a function

- [ ] **Step 3: Write minimal implementation**

```ts
// add to src/shared/drive.ts
import { createHash } from 'node:crypto'

/** SHA-256/base64url PKCE code challenge for a verifier. Pure. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

/** True when the remote file changed since we loaded `base` (both RFC-3339).
 *  An empty/unknown remote time never blocks. */
export function isConflict(base: string, remote: string): boolean {
  if (!remote || !base) return false
  return new Date(remote).getTime() > new Date(base).getTime()
}
```

> Note: `src/shared/drive.ts` already imports `node:crypto` here; that is fine
> because `shared` modules are only consumed by main + tests, never bundled
> into the renderer. (The renderer imports only the *types* and `parseRef`/
> `gdriveRef`/`isGdrive`, which don't pull in crypto under tree-shaking. If the
> web build complains, move `pkceChallenge` to `src/main/drive/oauth.ts` and
> keep its test there.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/drive.test.ts`
Expected: PASS

- [ ] **Step 5: Verify the web build still tree-shakes crypto out**

Run: `npm run typecheck && npm run build`
Expected: build succeeds. If the renderer bundle errors on `node:crypto`, apply the fallback in the note above, then re-run.

- [ ] **Step 6: Commit**

```bash
git add src/shared/drive.ts src/shared/drive.test.ts
git commit -m "Drive: PKCE challenge + conflict (mtime) helpers"
```

---

## Phase 1 — Main: account store

### Task 4: Encrypted account persistence

**Files:**
- Create: `src/main/drive/accounts.ts`

Refresh tokens are encrypted with `safeStorage` and stored alongside the
account record. Access tokens are never persisted (kept in `DriveService`).

- [ ] **Step 1: Implement**

```ts
// src/main/drive/accounts.ts
import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { DriveAccount } from '../../shared/drive'

/** Persisted record: refresh token is base64 of safeStorage ciphertext. */
interface StoredAccount {
  accountId: string
  email: string
  clientId: string
  refreshTokenEnc: string
}

const FILE = (): string => join(app.getPath('userData'), 'drive-accounts.json')

async function readAll(): Promise<StoredAccount[]> {
  const raw = await fs.readFile(FILE(), 'utf8').catch(() => '[]')
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

async function writeAll(list: StoredAccount[]): Promise<void> {
  await fs.writeFile(FILE(), JSON.stringify(list, null, 2), 'utf8')
}

function enc(token: string): string {
  return safeStorage.encryptString(token).toString('base64')
}
function dec(b64: string): string {
  return safeStorage.decryptString(Buffer.from(b64, 'base64'))
}

/** Public account list for the renderer (no secrets). */
export async function listAccounts(): Promise<DriveAccount[]> {
  return (await readAll()).map((a) => ({ accountId: a.accountId, email: a.email }))
}

/** Insert or update an account (dedup by accountId). */
export async function upsertAccount(
  accountId: string,
  email: string,
  clientId: string,
  refreshToken: string
): Promise<void> {
  const list = await readAll()
  const rec: StoredAccount = { accountId, email, clientId, refreshTokenEnc: enc(refreshToken) }
  const i = list.findIndex((a) => a.accountId === accountId)
  if (i >= 0) list[i] = rec
  else list.push(rec)
  await writeAll(list)
}

export async function removeAccount(accountId: string): Promise<void> {
  await writeAll((await readAll()).filter((a) => a.accountId !== accountId))
}

/** The decrypted refresh token + clientId used for an account, or null. */
export async function accountSecret(
  accountId: string
): Promise<{ refreshToken: string; clientId: string } | null> {
  const rec = (await readAll()).find((a) => a.accountId === accountId)
  if (!rec) return null
  return { refreshToken: dec(rec.refreshTokenEnc), clientId: rec.clientId }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/drive/accounts.ts
git commit -m "Drive: encrypted account store (safeStorage)"
```

---

## Phase 2 — Main: OAuth flow

### Task 5: PKCE loopback OAuth

**Files:**
- Create: `src/main/drive/oauth.ts`

- [ ] **Step 1: Implement**

```ts
// src/main/drive/oauth.ts
import { shell, net } from 'electron'
import { createServer } from 'http'
import { randomBytes } from 'crypto'
import { pkceChallenge } from '../../shared/drive'

/** Built-in OAuth client. Replace with your Google Cloud Desktop client id.
 *  Empty string ⇒ no built-in client (BYO only). */
export const BUILTIN_CLIENT_ID = ''

const SCOPE = 'https://www.googleapis.com/auth/drive openid email'
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo'

export interface ConnectResult {
  accountId: string
  email: string
  refreshToken: string
  accessToken: string
  expiresAt: number
}

const b64url = (b: Buffer): string => b.toString('base64url')

/** Run the full interactive connect flow; resolves with tokens + identity. */
export async function connect(clientId: string): Promise<ConnectResult> {
  const verifier = b64url(randomBytes(32))
  const challenge = pkceChallenge(verifier)
  const state = b64url(randomBytes(16))

  const { code, redirectUri } = await captureCode((port) => {
    const u = new URL(AUTH)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('client_id', clientId)
    u.searchParams.set('redirect_uri', `http://127.0.0.1:${port}`)
    u.searchParams.set('scope', SCOPE)
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    u.searchParams.set('access_type', 'offline')
    u.searchParams.set('prompt', 'consent')
    u.searchParams.set('state', state)
    void shell.openExternal(u.toString())
  }, state)

  const tok = await postForm(TOKEN, {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    code_verifier: verifier,
    redirect_uri: redirectUri
  })
  const info = await getJson(USERINFO, tok.access_token)
  return {
    accountId: info.sub,
    email: info.email,
    refreshToken: tok.refresh_token,
    accessToken: tok.access_token,
    expiresAt: Date.now() + tok.expires_in * 1000
  }
}

/** Exchange a stored refresh token for a fresh access token. */
export async function refresh(
  clientId: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const tok = await postForm(TOKEN, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId
  })
  return { accessToken: tok.access_token, expiresAt: Date.now() + tok.expires_in * 1000 }
}

/** Start a one-shot loopback server, invoke `open(port)`, await the code. */
function captureCode(
  open: (port: number) => void,
  state: string
): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const gotState = url.searchParams.get('state')
      res.end('<html><body style="font:14px sans-serif">Inkwell: you can close this tab.</body></html>')
      server.close()
      clearTimeout(timer)
      if (!code || gotState !== state) reject(new Error('OAuth was cancelled or failed.'))
      else resolve({ code, redirectUri: `http://127.0.0.1:${(server.address() as { port: number }).port}` })
    })
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Sign-in timed out.'))
    }, 120_000)
    server.listen(0, '127.0.0.1', () => open((server.address() as { port: number }).port))
  })
}

async function postForm(url: string, body: Record<string, string>): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const r = await net.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  })
  if (!r.ok) throw new Error(`token endpoint ${r.status}: ${await r.text()}`)
  return r.json()
}

async function getJson(url: string, accessToken: string): Promise<{ sub: string; email: string }> {
  const r = await net.fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  if (!r.ok) throw new Error(`userinfo ${r.status}`)
  return r.json()
}
```

> The `redirectUri` reported by `captureCode` recomputes the port from
> `server.address()` *after* close; capture it before `server.close()` in
> practice. (Implementation detail for the engineer: read the port in the
> `listen` callback into a variable and reuse it in both `open` and the
> resolved `redirectUri`.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/drive/oauth.ts
git commit -m "Drive: PKCE loopback OAuth (connect + refresh)"
```

---

## Phase 3 — Main: Drive REST client + service

### Task 6: REST client

**Files:**
- Create: `src/main/drive/api.ts`

- [ ] **Step 1: Implement**

```ts
// src/main/drive/api.ts
import { net } from 'electron'
import { mapDriveFiles, type DriveNode } from '../../shared/drive'

const BASE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

const auth = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` })

export async function list(token: string, folderId: string): Promise<DriveNode[]> {
  const files: { id: string; name: string; mimeType: string; modifiedTime?: string }[] = []
  let pageToken = ''
  do {
    const u = new URL(`${BASE}/files`)
    u.searchParams.set('q', `'${folderId}' in parents and trashed=false`)
    u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,modifiedTime)')
    u.searchParams.set('pageSize', '200')
    u.searchParams.set('orderBy', 'folder,name')
    if (pageToken) u.searchParams.set('pageToken', pageToken)
    const r = await net.fetch(u.toString(), { headers: auth(token) })
    if (!r.ok) throw new Error(`list ${r.status}: ${await r.text()}`)
    const j = await r.json()
    files.push(...(j.files ?? []))
    pageToken = j.nextPageToken ?? ''
  } while (pageToken)
  return mapDriveFiles(files)
}

export async function read(token: string, fileId: string): Promise<string> {
  const r = await net.fetch(`${BASE}/files/${fileId}?alt=media`, { headers: auth(token) })
  if (!r.ok) throw new Error(`read ${r.status}`)
  return r.text()
}

export async function meta(token: string, fileId: string): Promise<{ modifiedTime: string; name: string }> {
  const r = await net.fetch(`${BASE}/files/${fileId}?fields=id,name,modifiedTime`, { headers: auth(token) })
  if (!r.ok) throw new Error(`meta ${r.status}`)
  return r.json()
}

export async function write(token: string, fileId: string, content: string): Promise<{ modifiedTime: string }> {
  const r = await net.fetch(`${UPLOAD}/files/${fileId}?uploadType=media&fields=modifiedTime`, {
    method: 'PATCH',
    headers: { ...auth(token), 'content-type': 'text/markdown' },
    body: content
  })
  if (!r.ok) throw new Error(`write ${r.status}: ${await r.text()}`)
  return r.json()
}

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
  return mapDriveFiles([await r.json()])[0]
}

/** Deterministic small hash for a stable multipart boundary (no Math.random). */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/drive/api.ts
git commit -m "Drive: REST client (list/read/write/create/meta)"
```

### Task 7: DriveService (token cache + orchestration)

**Files:**
- Create: `src/main/drive/index.ts`

- [ ] **Step 1: Implement**

```ts
// src/main/drive/index.ts
import { isConflict, type DriveAccount, type DriveNode } from '../../shared/drive'
import * as accounts from './accounts'
import * as oauth from './oauth'
import * as api from './api'

/** Holds in-memory access tokens and a per-account override client id. */
class DriveService {
  private tokens = new Map<string, { accessToken: string; expiresAt: number }>()
  private byoClientId: string | null = null

  setClientId(id: string | null): void {
    this.byoClientId = id && id.trim() ? id.trim() : null
  }

  private clientId(): string {
    return this.byoClientId || oauth.BUILTIN_CLIENT_ID
  }

  list(): Promise<DriveAccount[]> {
    return accounts.listAccounts()
  }

  async connect(): Promise<DriveAccount> {
    const clientId = this.clientId()
    if (!clientId) throw new Error('No Google client id configured. Set one in Preferences ▸ Cloud.')
    const r = await oauth.connect(clientId)
    await accounts.upsertAccount(r.accountId, r.email, clientId, r.refreshToken)
    this.tokens.set(r.accountId, { accessToken: r.accessToken, expiresAt: r.expiresAt })
    return { accountId: r.accountId, email: r.email }
  }

  async disconnect(accountId: string): Promise<void> {
    this.tokens.delete(accountId)
    await accounts.removeAccount(accountId)
  }

  private async token(accountId: string): Promise<string> {
    const cached = this.tokens.get(accountId)
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.accessToken
    const secret = await accounts.accountSecret(accountId)
    if (!secret) throw new Error('Account not connected.')
    const fresh = await oauth.refresh(secret.clientId, secret.refreshToken)
    this.tokens.set(accountId, fresh)
    return fresh.accessToken
  }

  async listFolder(accountId: string, folderId: string): Promise<DriveNode[]> {
    return api.list(await this.token(accountId), folderId || 'root')
  }

  async read(accountId: string, fileId: string): Promise<{ content: string; modifiedTime: string }> {
    const token = await this.token(accountId)
    const [content, m] = await Promise.all([api.read(token, fileId), api.meta(token, fileId)])
    return { content, modifiedTime: m.modifiedTime }
  }

  async write(
    accountId: string,
    fileId: string,
    content: string,
    baseModifiedTime: string
  ): Promise<{ modifiedTime: string } | { conflict: true }> {
    const token = await this.token(accountId)
    const current = await api.meta(token, fileId)
    if (isConflict(baseModifiedTime, current.modifiedTime)) return { conflict: true }
    return api.write(token, fileId, content)
  }

  async create(accountId: string, parentId: string, name: string, content: string): Promise<DriveNode> {
    return api.create(await this.token(accountId), parentId || 'root', name, content)
  }
}

export const drive = new DriveService()
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/main/drive/index.ts
git commit -m "Drive: service (token cache, connect/list/read/write/create)"
```

---

## Phase 4 — IPC wiring

### Task 8: IPC channels + types

**Files:**
- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: Add channels + re-export types**

Add to the `IPC` object (near the other feature groups):

```ts
  // google drive (cloud mode)
  driveListAccounts: 'drive:listAccounts',
  driveConnect: 'drive:connect',
  driveDisconnect: 'drive:disconnect',
  driveList: 'drive:list',
  driveRead: 'drive:read',
  driveWrite: 'drive:write',
  driveCreate: 'drive:create',
  driveSetClientId: 'drive:setClientId',
  driveAccountsChanged: 'drive:accountsChanged',
```

Add near the other shared interfaces:

```ts
export type { DriveAccount, DriveNode } from './drive'
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/shared/ipc.ts
git commit -m "Drive: IPC channel names + shared type re-exports"
```

### Task 9: Main IPC handlers

**Files:**
- Create: `src/main/ipc/drive.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Implement handlers**

```ts
// src/main/ipc/drive.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/ipc'
import { drive } from '../drive'

export function registerDriveIpc(): void {
  ipcMain.handle(IPC.driveListAccounts, () => drive.list())

  ipcMain.handle(IPC.driveConnect, async (e) => {
    const account = await drive.connect()
    BrowserWindow.fromWebContents(e.sender)?.webContents.send(IPC.driveAccountsChanged)
    return account
  })

  ipcMain.handle(IPC.driveDisconnect, async (e, accountId: string) => {
    await drive.disconnect(accountId)
    BrowserWindow.fromWebContents(e.sender)?.webContents.send(IPC.driveAccountsChanged)
  })

  ipcMain.handle(IPC.driveList, (_e, accountId: string, folderId: string) =>
    drive.listFolder(accountId, folderId)
  )
  ipcMain.handle(IPC.driveRead, (_e, accountId: string, fileId: string) => drive.read(accountId, fileId))
  ipcMain.handle(IPC.driveWrite, (_e, accountId: string, fileId: string, content: string, base: string) =>
    drive.write(accountId, fileId, content, base)
  )
  ipcMain.handle(IPC.driveCreate, (_e, accountId: string, parentId: string, name: string, content: string) =>
    drive.create(accountId, parentId, name, content)
  )
  ipcMain.handle(IPC.driveSetClientId, (_e, id: string | null) => drive.setClientId(id))
}
```

`drive.connect()` may reject (user cancels / timeout). `ipcMain.handle`
propagates the rejection to the renderer's `invoke` as a rejected promise; the
renderer catches it (Task 13).

- [ ] **Step 2: Register in main**

In `src/main/index.ts`, import and call alongside the other `register*Ipc()`:

```ts
import { registerDriveIpc } from './ipc/drive'
// …inside app.whenReady().then(() => { … after registerGraphIpc() }):
  registerDriveIpc()
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/main/ipc/drive.ts src/main/index.ts
git commit -m "Drive: main IPC handlers + registration"
```

### Task 10: Preload surface

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add `drive` to the api object**

Import the types and add a nested `drive` object on `api`:

```ts
import type { DriveAccount, DriveNode } from '../shared/ipc'
// …
  drive: {
    listAccounts: (): Promise<DriveAccount[]> => ipcRenderer.invoke(IPC.driveListAccounts),
    connect: (): Promise<DriveAccount> => ipcRenderer.invoke(IPC.driveConnect),
    disconnect: (accountId: string): Promise<void> => ipcRenderer.invoke(IPC.driveDisconnect, accountId),
    list: (accountId: string, folderId: string): Promise<DriveNode[]> =>
      ipcRenderer.invoke(IPC.driveList, accountId, folderId),
    read: (accountId: string, fileId: string): Promise<{ content: string; modifiedTime: string }> =>
      ipcRenderer.invoke(IPC.driveRead, accountId, fileId),
    write: (
      accountId: string,
      fileId: string,
      content: string,
      base: string
    ): Promise<{ modifiedTime: string } | { conflict: true }> =>
      ipcRenderer.invoke(IPC.driveWrite, accountId, fileId, content, base),
    create: (accountId: string, parentId: string, name: string, content: string): Promise<DriveNode> =>
      ipcRenderer.invoke(IPC.driveCreate, accountId, parentId, name, content),
    setClientId: (id: string | null): Promise<void> => ipcRenderer.invoke(IPC.driveSetClientId, id)
  },
  onDriveAccountsChanged: (handler: () => void): (() => void) => {
    const l = (): void => handler()
    ipcRenderer.on(IPC.driveAccountsChanged, l)
    return () => ipcRenderer.removeListener(IPC.driveAccountsChanged, l)
  }
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/preload/index.ts
git commit -m "Drive: preload window.api.drive surface"
```

---

## Phase 5 — Renderer: store + dispatch

### Task 11: Store accounts

**Files:**
- Modify: `src/renderer/src/store/useAppStore.ts`

- [ ] **Step 1: Add state + actions**

Add to the interface and initial state (mirroring `gitStatus`):

```ts
// interface
  driveAccounts: DriveAccount[]
  setDriveAccounts: (a: DriveAccount[]) => void
// import
import type { /* …existing… */ DriveAccount } from '@shared/ipc'
// initial state
  driveAccounts: [],
  setDriveAccounts: (driveAccounts) => set({ driveAccounts }),
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/renderer/src/store/useAppStore.ts
git commit -m "Drive: store driveAccounts state"
```

### Task 12: File-source dispatch

**Files:**
- Create: `src/renderer/src/lib/fileSource.ts`

- [ ] **Step 1: Implement**

```ts
// src/renderer/src/lib/fileSource.ts
import { parseRef } from '@shared/drive'

/** Load a doc by ref. Returns content + (for Drive) the base modifiedTime. */
export async function readRef(
  path: string
): Promise<{ content: string; name: string; modifiedTime?: string }> {
  const ref = parseRef(path)
  if (ref.provider === 'gdrive') {
    const { content, modifiedTime } = await window.api.drive.read(ref.accountId, ref.fileId)
    return { content, name: '', modifiedTime }
  }
  const file = await window.api.readFile(path)
  return { content: file.content, name: file.name }
}

/** Persist a doc by ref. For Drive, returns the new modifiedTime or a conflict. */
export async function writeRef(
  path: string,
  content: string,
  baseModifiedTime: string
): Promise<{ ok: true; modifiedTime?: string } | { ok: false; conflict: true }> {
  const ref = parseRef(path)
  if (ref.provider === 'gdrive') {
    const res = await window.api.drive.write(ref.accountId, ref.fileId, content, baseModifiedTime)
    if ('conflict' in res) return { ok: false, conflict: true }
    return { ok: true, modifiedTime: res.modifiedTime }
  }
  await window.api.saveFile(path, content)
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/renderer/src/lib/fileSource.ts
git commit -m "Drive: renderer read/write dispatch (local vs gdrive)"
```

### Task 13: Renderer Drive actions + modifiedTime tracking

**Files:**
- Create: `src/renderer/src/lib/drive.ts`
- Modify: `src/renderer/src/store/useAppStore.ts` (track per-doc `modifiedTime`)
- Modify: `src/renderer/src/lib/docActions.ts`

The doc needs to remember the Drive `modifiedTime` it was loaded at, for the
save-time conflict check. Add `driveBase: string` to `DocState` (empty for
local docs); set it on open, update it after a successful Drive write.

- [ ] **Step 1: Extend DocState**

In `useAppStore.ts`, add `driveBase?: string` to `DocState` and thread it
through `loadDoc`/`openInTab`/`markSaved` (default `''`). Add an action
`setDriveBase: (t: string) => void` that patches `doc.driveBase`.

- [ ] **Step 2: Implement drive actions**

```ts
// src/renderer/src/lib/drive.ts
import { gdriveRef, type DriveNode } from '@shared/drive'
import { useAppStore } from '@renderer/store/useAppStore'

export async function refreshAccounts(): Promise<void> {
  useAppStore.getState().setDriveAccounts(await window.api.drive.listAccounts().catch(() => []))
}

export async function connectAccount(): Promise<{ ok: boolean; error?: string }> {
  try {
    await window.api.drive.connect()
    await refreshAccounts()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) }
  }
}

export async function disconnectAccount(accountId: string): Promise<void> {
  await window.api.drive.disconnect(accountId)
  await refreshAccounts()
}

export function listChildren(accountId: string, folderId: string): Promise<DriveNode[]> {
  return window.api.drive.list(accountId, folderId)
}

/** Open a Drive file in a tab (path = gdrive://account/file), remembering its base mtime. */
export async function openDriveFile(accountId: string, node: DriveNode): Promise<void> {
  const { content, modifiedTime } = await window.api.drive.read(accountId, node.id)
  const store = useAppStore.getState()
  store.openInTab({ path: gdriveRef(accountId, node.id), name: node.name, content })
  store.setDriveBase(modifiedTime)
}
```

- [ ] **Step 3: Route saveDoc through fileSource**

In `docActions.ts` `saveDoc()`, when `doc.path` is a `gdrive:` ref use
`writeRef`; on `conflict` show the existing external-change/confirm modal
("File changed on Drive. Overwrite?"); on success call `markSaved` and
`setDriveBase(modifiedTime)`. Keep the local branch unchanged. Guard
`snapshotVersion` and `refreshGitStatus` to local paths only (`!isGdrive`).

```ts
import { isGdrive, parseRef } from '@shared/drive'
import { writeRef } from './fileSource'
// inside saveDoc(), before the local fs branch:
  if (doc.path && isGdrive(doc.path)) {
    const res = await writeRef(doc.path, contentForDisk(), useAppStore.getState().doc.driveBase ?? '')
    if (!res.ok) {
      const choice = await useConfirm.getState().ask({
        title: 'File changed on Drive',
        message: 'This file was modified on Google Drive since you opened it. Overwrite it with your version?',
        confirmLabel: 'Overwrite',
        discardLabel: 'Cancel'
      })
      if (choice !== 'save') return false
      // force: write with an empty base to skip the conflict check
      const forced = await writeRef(doc.path, contentForDisk(), '')
      if (!forced.ok) return false
      markSaved()
      if (forced.modifiedTime) useAppStore.getState().setDriveBase(forced.modifiedTime)
      return true
    }
    markSaved()
    if (res.modifiedTime) useAppStore.getState().setDriveBase(res.modifiedTime)
    return true
  }
```

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add src/renderer/src/lib/drive.ts src/renderer/src/store/useAppStore.ts src/renderer/src/lib/docActions.ts
git commit -m "Drive: renderer actions + save dispatch with conflict guard"
```

---

## Phase 6 — Renderer: UI

### Task 14: Cloud accounts in the sidebar

**Files:**
- Modify: `src/renderer/src/components/FileTree.tsx`
- Modify: `src/renderer/src/App.tsx` (load accounts on launch)

- [ ] **Step 1: Load accounts + subscribe to changes**

In `App.tsx`, in the startup effect that wires sync helpers, call
`refreshAccounts()` and subscribe `window.api.onDriveAccountsChanged(refreshAccounts)`.

- [ ] **Step 2: Render Cloud roots**

In `FileTree.tsx`, below the local tree (and inside the `!root` StartScreen
too, so Drive is reachable with no local folder open), add a "Cloud" section:
read `driveAccounts` from the store; for each account render a collapsible root
whose children come from `listChildren(accountId, 'root')`, lazy-loaded on
expand. Reuse the existing `TreeRow` visual pattern with a new
`DriveTreeRow` that, on a folder, calls `listChildren(accountId, node.id)`, and
on a file calls `openDriveFile(accountId, node)`. Add a **"＋ Connect Google
Drive…"** button that calls the connect flow (Task 15).

```tsx
// sketch — a Drive row
function DriveTreeRow({ accountId, node, depth }: { accountId: string; node: DriveNode; depth: number }) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<DriveNode[] | null>(null)
  const isDir = node.type === 'directory'
  const onClick = async () => {
    if (!isDir) return void openDriveFile(accountId, node)
    const next = !open
    setOpen(next)
    if (next && !children) setChildren(await listChildren(accountId, node.id))
  }
  return (
    <div>
      <button onClick={() => void onClick()} style={{ paddingLeft: depth * 12 + 8 }}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[13px] text-ink/80 hover:bg-ink/5">
        <span className="w-3 shrink-0 text-faint">{isDir ? (open ? '▾' : '▸') : ''}</span>
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
      {isDir && open && children?.map((c) => (
        <DriveTreeRow key={c.id} accountId={accountId} node={c} depth={depth + 1} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/renderer/src/components/FileTree.tsx src/renderer/src/App.tsx
git commit -m "Drive: Cloud accounts as browsable roots in the sidebar"
```

### Task 15: Connect modal + menu/command entry

**Files:**
- Create: `src/renderer/src/components/DriveConnect.tsx`
- Modify: `src/main/menu.ts`, `src/shared/ipc.ts`, `src/preload/index.ts`, `src/renderer/src/lib/commands.ts`, `src/renderer/src/App.tsx`

- [ ] **Step 1: Add a menu channel `menuConnectDrive`** (File menu item "Connect Google Drive…"), to the IPC object, preload `menuChannels`, `menu.ts` (File submenu), and `commands.ts` (File category). Mirror an existing menu item exactly.

- [ ] **Step 2: DriveConnect modal**

A component that listens for `menuConnectDrive` (and is also invoked by the
sidebar button via a shared `window.dispatchEvent`/store flag). On trigger it
shows "Waiting for Google sign-in in your browser…", calls `connectAccount()`,
then closes on success or shows `error`. Mount it in `App.tsx`.

```tsx
// src/renderer/src/components/DriveConnect.tsx — essential shape
export default function DriveConnect(): JSX.Element | null {
  const [state, setState] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [error, setError] = useState('')
  useEffect(() => window.api.onMenu(IPC.menuConnectDrive, start), [])
  const start = () => {
    setState('waiting'); setError('')
    void connectAccount().then((r) => {
      if (r.ok) setState('idle')
      else { setError(r.error || 'Sign-in failed'); setState('error') }
    })
  }
  if (state === 'idle') return null
  return (/* modal: spinner + "Waiting for Google sign-in in your browser…" or error + Close */)
}
```

- [ ] **Step 3: Typecheck + lint + commit**

```bash
git add -A
git commit -m "Drive: Connect flow modal + File menu / palette entry"
```

### Task 16: Preferences ▸ Cloud pane

**Files:**
- Modify: `src/renderer/src/components/PreferencesModal.tsx`

- [ ] **Step 1: Add a "Cloud" pane**

Following the existing pane pattern in `PreferencesModal.tsx`, add a Cloud
pane: list `driveAccounts` (email + a "Disconnect" button → `disconnectAccount`),
a "Connect account" button (triggers the same connect flow), and an
**Advanced** text input for a custom OAuth client id that, on change, calls
`window.api.drive.setClientId(value || null)` and persists it to settings
(add `driveClientId: string` to `settings.ts`/`settingsSync.ts`, default `''`,
and push it to main on startup via `setClientId`).

- [ ] **Step 2: Typecheck + lint + commit**

```bash
git add -A
git commit -m "Drive: Preferences ▸ Cloud pane (accounts + BYO client id)"
```

### Task 17: New-file-in-Drive-folder + guard local-only features

**Files:**
- Modify: `src/renderer/src/components/FileTree.tsx` (Drive folder context action)
- Modify: any local-only call sites still reachable for `gdrive:` docs

- [ ] **Step 1: New file action**

On a Drive folder row, add a context action "New File…" that prompts for a name
(reuse `PromptModal`), calls `window.api.drive.create(accountId, folderId, name, '')`,
then `openDriveFile(accountId, createdNode)`.

- [ ] **Step 2: Guard local-only features**

Audit the watch/git/version call sites for the active doc and skip them when
`isGdrive(doc.path)`: file-watch registration (no fs watch for Drive), git
status refresh after save (already guarded in Task 13), local version snapshot
(skip), "Reveal in File Manager" (hide for Drive tabs).

- [ ] **Step 3: Typecheck + lint + commit**

```bash
git add -A
git commit -m "Drive: create files in Drive folders; guard local-only features"
```

---

## Phase 7 — Docs + live verification

### Task 18: Google Cloud setup guide

**Files:**
- Create: `docs/google-drive-setup.md`

- [ ] **Step 1: Write the guide** covering: create a Google Cloud project, enable the Drive API, configure the OAuth consent screen (External; scopes `drive`, `openid`, `email`; add test users), create a **Desktop app** OAuth client, copy the `client_id` into `BUILTIN_CLIENT_ID` (`src/main/drive/oauth.ts`) for a built-in build, or paste it into Preferences ▸ Cloud ▸ Advanced for BYO. Note the unverified-app screen and ~100-user cap.

- [ ] **Step 2: Commit**

```bash
git add docs/google-drive-setup.md
git commit -m "Docs: Google Drive OAuth client setup guide"
```

### Task 19: Live verification (probe)

Once a real `client_id` is available (built-in or BYO), verify end-to-end with
the project's probe pattern (temporary code in `main/index.ts` `did-finish-load`,
removed after):

- [ ] Mock-token path (no real Google): point `TOKEN`/`USERINFO` at a local stub server; drive the loopback by hitting `http://127.0.0.1:<port>/?code=X&state=…` and assert `connect()` resolves with the stub identity → confirms the loopback + exchange wiring.
- [ ] Dispatch path: stub `drive` service in main; from the renderer, `openInTab` a `gdrive://acc/file` doc and assert `saveDoc()` routes to `drive.write` (not `saveFile`).
- [ ] Manual one-time: with a real `client_id`, Connect an account, browse, open a `.md`, edit, Save, and confirm the change on Drive; reopen to confirm persistence; trigger a conflict by editing on Drive then saving.
- [ ] Remove all probe code; run `npm run typecheck && npm run lint && npm run build && npx vitest run`.

---

## Self-review notes

- **Spec coverage:** auth (Task 5), accounts/tokens (Task 4), REST (Task 6), service (Task 7), IPC/preload (Tasks 8–10), virtual-path identity + dispatch + guards (Tasks 1, 12, 13, 17), sidebar roots (Task 14), connect UX (Task 15), Preferences + BYO (Task 16), conflict check (Tasks 3, 7, 13), drafts (unchanged — covered by the URI key), docs/prereq (Task 18), testing (Tasks 1–3 pure; Task 19 probe). All spec sections map to a task.
- **Type consistency:** `DriveAccount`/`DriveNode` defined in Task 1 and reused everywhere; `drive.write` returns `{modifiedTime}|{conflict:true}` consistently across api/service/preload/fileSource; `driveBase` threaded through DocState (Task 13).
- **Known follow-ups inside tasks:** Task 5 notes capturing the loopback port before `server.close()`; Task 3 notes the crypto/tree-shaking fallback.
