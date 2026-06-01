# Google Drive setup

Inkwell connects to Google Drive with your own OAuth client. The app ships with
a built-in client id, but for unlimited use (and to avoid Google's
"unverified app" screen / ~100-user cap) you can use your own. Either way the
flow is **Authorization Code + PKCE** with a loopback redirect — there is **no
client secret**.

## A. Use the built-in client (fastest)

1. Open Inkwell → **File ▸ Connect Google Drive…** (or the **＋ Connect** button
   in the sidebar's Cloud section).
2. Your browser opens Google's consent screen. If the app is unverified you'll
   see a warning — choose **Advanced ▸ Go to Inkwell (unsafe)** to continue
   (only possible if the maintainer added you as a test user).
3. Grant access. The browser shows "you can close this tab"; the account
   appears under **Cloud** in the sidebar.

> The built-in client is capped at ~100 users until it passes Google's CASA
> security assessment. For your own unlimited, no-warning use, set up a client
> of your own (below).

## B. Use your own client (recommended for real use)

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
  redirect on a random port).
- Copy the **Client ID** (looks like `…apps.googleusercontent.com`).

### 5. Tell Inkwell to use it
- Either **paste it** into **Preferences ▸ Cloud ▸ Advanced ▸ Custom OAuth
  client ID** (per-user, no rebuild), or
- set `BUILTIN_CLIENT_ID` in `src/main/drive/oauth.ts` and rebuild (for a
  custom distribution).

Then **File ▸ Connect Google Drive…** and sign in.

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
