# Google Drive integration — design

Status: approved (design) · 2026-06-01 · branch `feat/google-drive`

## 1. Goal & summary

Add a **Cloud mode** to Inkwell: connect one or more Google accounts and
read/write Markdown files directly on Google Drive. Each connected account
appears as a **browsable root** in the Files sidebar tab, alongside local
folders. Opening a Drive file loads it into a normal editor tab; **Save**
uploads it back. Multiple accounts are supported simultaneously.

Decisions locked during brainstorming:

| Axis | Choice |
| --- | --- |
| Audience | Public app (pragmatically: built-in client → "unverified" screen + ~100-user cap; BYO for unlimited) |
| Access scope | **Full Drive** (`https://www.googleapis.com/auth/drive`) |
| Integration model | **Account as a browsable root** in the sidebar (virtual-path identity) |
| Write / offline | **Online only**, explicit `Ctrl+S` → upload (local cache for crash drafts) |
| Credentials | **Built-in `client_id`** (default) **+ BYO** custom client id (Preferences) |
| Auth | Authorization Code + **PKCE**, loopback redirect, system browser |
| Dependencies | **Hand-rolled** OAuth/REST via `net.fetch` (no `googleapis`) |

Non-goals for v1 (deferred): rename/delete/move on Drive, Google Docs →
Markdown export, full-text Drive search, offline edit queue / background sync,
"Save As → Drive", shared drives.

## 2. Architecture

All Drive logic lives in the **main process**; the renderer never sees tokens.

```
src/shared/drive.ts            pure types + helpers (URI encode/decode, mime, list→node)
src/main/drive/
  oauth.ts                     PKCE, loopback server, token exchange/refresh
  accounts.ts                  account store (safeStorage-encrypted refresh tokens)
  api.ts                       Drive REST client (list/read/write/create/meta) via net.fetch
src/main/ipc/drive.ts          registerDriveIpc(): IPC handlers
src/preload/index.ts           window.api.drive.* surface
src/renderer/src/
  lib/fileSource.ts            parseRef() + read/write dispatch (local fs vs gdrive)
  lib/drive.ts                 renderer actions (connect, list, open, save, disconnect)
  components/...               sidebar Cloud section, Preferences ▸ Cloud pane, connect modal
```

Reuses existing patterns: the `IPC` contract object, `net.fetch` (already used
by spell/pandoc/inkfile), the modal/component conventions, and the store.

## 3. File identity — the "virtual path" keystone

A Drive document is identified by a URI placed in the existing `doc.path`
field:

```
gdrive://<accountId>/<fileId>
```

- `accountId` — the Google account's stable subject id (`sub` from the
  OIDC userinfo). Stable across reconnects and dedupes the same account.
- `fileId` — Drive's file id.

Because **tabs, recent files, session restore, crash-recovery drafts, and
caret memory all key on `path` as an opaque string**, they keep working for
Drive docs with no changes. Only code that actually touches the disk must
branch on the provider:

- `src/shared/drive.ts` exports `parseRef(path): { provider: 'local' } | { provider: 'gdrive', accountId, fileId }` and `gdriveRef(accountId, fileId)`.
- A renderer dispatcher routes reads/writes: local → `window.api.readFile/saveFile`; gdrive → `window.api.drive.read/write`.

Local-only features are **guarded off** for `gdrive:` paths:

| Feature | Behaviour for a Drive doc |
| --- | --- |
| File watch (fs) | disabled; replaced by an on-save `modifiedTime` conflict check |
| Git status/actions | disabled (no repo) |
| Reveal in File Manager | hidden |
| Local version history | skipped in v1 |
| Crash-recovery drafts | **kept** (content cached locally by the URI key) |

## 4. Authentication (OAuth 2.0, PKCE, loopback)

1. **Connect account** → main generates a PKCE `code_verifier`/`code_challenge`
   and a random `state`; starts a one-shot `http.createServer` on
   `127.0.0.1:0` (ephemeral port).
2. Opens the **system browser** (`shell.openExternal`) to the consent URL:
   `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=…&redirect_uri=http://127.0.0.1:<port>&scope=<drive openid email>&code_challenge=…&code_challenge_method=S256&access_type=offline&prompt=consent&state=…`
3. User consents in the browser → Google redirects to the loopback with
   `?code=…&state=…`. The server **validates `state`**, returns a tiny
   "you can close this tab" HTML page, and closes. A 2-minute timeout aborts
   a stalled flow.
4. Exchange `code` (+ `code_verifier`) at `https://oauth2.googleapis.com/token`
   → `access_token`, `refresh_token`, `expires_in`.
5. Fetch the account `sub` + email from
   `https://www.googleapis.com/oauth2/v3/userinfo` (`sub` → `accountId`,
   email → display). A duplicate `sub` updates the existing account.
6. Persist to `userData/drive-accounts.json`:
   `[{ accountId, email, clientId, refreshToken: <safeStorage-encrypted> }]`.
   Access tokens are **memory-only**, refreshed on demand (refresh-token grant)
   when expired or on a 401.

**Credentials.** A compiled-in built-in `client_id` (public client; PKCE means
no usable secret) is the default. Users can override it with their own
`client_id` in Preferences (BYO). The `clientId` used is stored per account
(refresh tokens are client-specific). The built-in path shows Google's
"unverified app" screen and is capped at ~100 users until a CASA assessment;
BYO removes the cap. This is documented for the user, not solved in code.

## 5. Drive REST client (`src/main/drive/api.ts`)

Thin wrapper over the Drive v3 REST API using `net.fetch`. Every call goes
through `withAuth(account)` which ensures a fresh access token.

| Function | Request |
| --- | --- |
| `list(account, folderId)` | `GET files?q='<folderId>' in parents and trashed=false&fields=files(id,name,mimeType,modifiedTime,parents),nextPageToken&pageSize=200` (+ paging). Root = `'root'`. |
| `read(account, fileId)` | `GET files/<id>?alt=media` → text |
| `write(account, fileId, content)` | `PATCH upload/drive/v3/files/<id>?uploadType=media` body `text/markdown` → new `modifiedTime` |
| `create(account, parentId, name, content)` | `POST upload/drive/v3/files?uploadType=multipart` (metadata + media) |
| `meta(account, fileId)` | `GET files/<id>?fields=id,name,modifiedTime,md5Checksum` (conflict check) |

`list` results map to a pure `DriveNode { id, name, type: 'file'|'directory', mimeType, modifiedTime }` via `src/shared/drive.ts`. Google Docs
(`application/vnd.google-apps.*`) are surfaced but not openable as raw text in
v1 (export → Markdown is deferred).

## 6. Renderer integration

- **Store**: add `driveAccounts: DriveAccount[]` (`{ accountId, email }`),
  loaded on launch via `window.api.drive.listAccounts()`, plus actions.
- **Files sidebar (FileTree)**: a "Cloud" section renders each connected
  account as a root; folders lazy-load via `window.api.drive.list`. Clicking a
  file → `openDriveFile(accountId, fileId, name)` → read → `openInTab` with
  `path = gdrive://accountId/fileId`. A **"Connect Google Drive…"** button +
  per-account "Disconnect" (context menu).
- **Open/Save dispatch**:
  - `openPath`/`openRef` reads local or Drive based on `parseRef`.
  - `saveDoc()`: a `gdrive:` path → `window.api.drive.write`. Before writing,
    compare the stored `modifiedTime` with `drive.meta`; if it changed on
    Drive, prompt (reuse the external-change modal). On success, `markSaved`
    and store the new `modifiedTime`.
  - **New Drive file**: a tree context-menu action on a Drive folder →
    `drive.create` → opens the new file. (Save As stays local in v1.)
- **Drafts**: unchanged — content is cached by the URI key, recovered on
  relaunch.
- **Preferences ▸ Cloud** pane: connected accounts (email + Disconnect),
  "Connect account", and **Advanced: custom OAuth client id** (BYO).
- **Connect feedback**: a modal "Waiting for Google sign-in in your browser…"
  while the loopback waits; on success the account appears, on
  timeout/error a message.

## 7. IPC surface (`src/shared/ipc.ts` + preload)

```
drive:listAccounts        → DriveAccount[]
drive:connect             → DriveAccount | { error }      (runs the OAuth flow)
drive:disconnect(id)      → void
drive:list(id, folderId)  → DriveNode[]
drive:read(id, fileId)    → { content, modifiedTime }
drive:write(id, fileId, content, baseModifiedTime) → { modifiedTime } | { conflict }
drive:create(id, parentId, name, content) → DriveNode
drive:meta(id, fileId)    → { modifiedTime, ... }
drive:setClientId(id|null)                               (BYO)
drive:accountsChanged     (main → renderer event)
```

## 8. Security

- `contextIsolation` stays on; the renderer receives only file content +
  metadata, never tokens.
- `refresh_token` encrypted at rest with `safeStorage`; access tokens are
  memory-only.
- Loopback server binds `127.0.0.1` on an ephemeral port, validates `state`
  (CSRF), is single-use, and times out.
- CSP unchanged — the renderer never calls Google; the consent screen is in the
  system browser. PKCE means the public client needs no secret.

## 9. v1 scope

Connect/disconnect (built-in + BYO), browse Drive folders, open + edit + save
(update) `.md`/text files, create a new file in a Drive folder, conflict
warning on save, crash-recovery drafts, multiple accounts.

## 10. Testing

- **Pure units** (`src/shared/drive.ts` + helpers): `parseRef`/`gdriveRef`
  round-trip, `list`-response → `DriveNode[]` mapping, mtime/conflict compare,
  token-expiry logic, PKCE challenge derivation (verifier → S256 challenge).
- **Drive API**: request-builders are pure and testable; `net.fetch` is
  injected so handlers can be tested against a stub.
- **Live (probe)**: automatable parts — the loopback server captures a `code`
  and the token-exchange request shape against a mock token endpoint; the
  renderer dispatch (`gdrive:` path → drive IPC) against a fake in-main
  provider. The **real** Google OAuth round-trip requires a one-time manual
  sign-in by the maintainer and a Google Cloud `client_id`.

## 11. Prerequisite (maintainer action, not code)

Create a **Google Cloud project** → enable the **Drive API** → configure the
**OAuth consent screen** (scopes `drive`, `openid`, `email`; add yourself as a
test user) → create a **Desktop app OAuth client** → its `client_id` is
compiled in as the built-in default. A step-by-step guide will ship in
`docs/`. Until that exists, only the **BYO** path (user pastes their own
`client_id`) can complete a real connection; all other code (pure helpers,
IPC, UI, dispatch) is testable without it.

## 12. Risks

- **OAuth verification**: built-in client is "unverified" + ~100-user cap
  until CASA; BYO unlocks unlimited. Documented, not coded around.
- **No live OAuth in CI/probe** — the real round-trip is manual.
- **Token/quota edge cases** (expiry, 401 refresh, rate limits) — handled by
  `withAuth` retry; surfaced as errors otherwise.
