# Google Drive setup

Inkwell ships **no Google credentials** — you create a Google Cloud OAuth
client and enter its **client ID + secret** in **Preferences ▸ Cloud**. They are
stored locally on your machine (the secret is encrypted per account in
userData). The sign-in flow is **Authorization Code + PKCE** with a loopback
redirect; Google additionally requires the client secret in the token exchange,
even for desktop apps (where it is, by Google's own docs, "not treated as a
secret").

## Create your OAuth client

### 1. Create a Google Cloud project
- Go to <https://console.cloud.google.com/> → create a project.

### 2. Enable the Drive API
- **APIs & Services ▸ Library** → search **Google Drive API** → **Enable**.

### 3. Configure the OAuth consent screen
- **APIs & Services ▸ OAuth consent screen** → User type **External** → fill in
  the app name and your email.
- **Scopes**: add `.../auth/drive`, `openid`, `email`.
- **Test users**: add the Google account(s) you'll sign in with (required while
  the app is unverified).

### 4. Create the OAuth client — **Desktop app**
- **APIs & Services ▸ Credentials ▸ + Create credentials ▸ OAuth client ID**.
- **Application type: Desktop app** (this is important — a *Web application*
  client will fail with `redirect_uri_mismatch` because Inkwell uses a loopback
  redirect on a random port, and also requires a different secret handling).
- Copy the **Client ID** (`…apps.googleusercontent.com`) and **Client secret**
  (`GOCSPX-…`). You can re-download both as JSON later.

### 5. Enter them in Inkwell
- **Preferences ▸ Cloud**: paste the **OAuth client ID** and **OAuth client
  secret**.
- Then **File ▸ Connect Google Drive…** (or the **＋ Connect** button in the
  sidebar) and sign in.

## What Inkwell stores

- The **refresh token** is encrypted with your OS keychain (`safeStorage`) and
  saved in `…/userData/drive-accounts.json`. Access tokens stay in memory only.
- **Disconnect** (Preferences ▸ Cloud) removes the stored account. To also
  revoke Inkwell's access entirely, visit
  <https://myaccount.google.com/permissions>.

## Notes / limits (v1)

- Reads/writes raw text files (`.md`, `.txt`, …). Google Docs/Sheets are listed
  but not opened as text (export to Markdown is a future feature).
- Saving checks the file's `modifiedTime`; if it changed on Drive since you
  opened it, Inkwell asks before overwriting.
- Online only — saving uploads on `Ctrl+S`. No offline queue yet.
