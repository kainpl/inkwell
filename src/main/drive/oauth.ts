import { shell, net } from 'electron'
import { createServer } from 'http'
import { randomBytes } from 'crypto'
import { pkceChallenge } from '../../shared/pkce'

/**
 * Google OAuth 2.0 for a desktop app: Authorization Code + PKCE with a loopback
 * redirect and the system browser. The client is "public" (no secret) — PKCE
 * is the protection. `connect()` runs the interactive flow; `refresh()` swaps a
 * stored refresh token for a fresh access token.
 */

/**
 * Built-in OAuth client (Google Cloud "Desktop app"). Google requires the
 * client_secret in the token exchange even for installed apps with PKCE — but
 * for a desktop client it is "not treated as a secret" (per Google's docs), so
 * it is shipped in the app just like the client id. Empty ⇒ BYO only.
 */
export const BUILTIN_CLIENT_ID = '108642972558-5k6kbg6ofhghd5r2o55tbuhs2ttj518a.apps.googleusercontent.com'
// Intentionally empty in the repo — do NOT commit a real client secret here.
// Provide it at runtime via Preferences ▸ Cloud (BYO), or load it from an
// untracked source for a built-in distribution. See docs/google-drive-setup.md.
export const BUILTIN_CLIENT_SECRET = ''

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

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

const b64url = (b: Buffer): string => b.toString('base64url')

/** Run the full interactive connect flow; resolves with tokens + identity. */
export async function connect(clientId: string, clientSecret: string): Promise<ConnectResult> {
  const verifier = b64url(randomBytes(32))
  const challenge = pkceChallenge(verifier)
  const state = b64url(randomBytes(16))

  const { code, redirectUri } = await captureCode(state, (redirect) => {
    const u = new URL(AUTH)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('client_id', clientId)
    u.searchParams.set('redirect_uri', redirect)
    u.searchParams.set('scope', SCOPE)
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    u.searchParams.set('access_type', 'offline')
    u.searchParams.set('prompt', 'consent')
    u.searchParams.set('state', state)
    void shell.openExternal(u.toString())
  })

  const tok = await postForm(TOKEN, {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: verifier,
    redirect_uri: redirectUri
  })
  if (!tok.refresh_token) throw new Error('Google did not return a refresh token. Try removing app access and reconnecting.')
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
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const tok = await postForm(TOKEN, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  })
  return { accessToken: tok.access_token, expiresAt: Date.now() + tok.expires_in * 1000 }
}

/**
 * Start a one-shot loopback server on an ephemeral port, invoke `open(redirect)`
 * with the resolved redirect URI, and await the authorization code. Validates
 * `state` (CSRF) and times out after 2 minutes.
 */
function captureCode(
  state: string,
  open: (redirectUri: string) => void
): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    let redirectUri = ''
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', redirectUri || 'http://127.0.0.1')
      res.end('<html><body style="font:14px sans-serif;padding:2rem">Inkwell — you can close this tab.</body></html>')
      clearTimeout(timer)
      server.close()
      const code = url.searchParams.get('code')
      if (!code || url.searchParams.get('state') !== state) {
        reject(new Error('Sign-in was cancelled or failed.'))
      } else {
        resolve({ code, redirectUri })
      }
    })
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Sign-in timed out.'))
    }, 120_000)
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      redirectUri = `http://127.0.0.1:${port}`
      open(redirectUri)
    })
  })
}

async function postForm(url: string, body: Record<string, string>): Promise<TokenResponse> {
  const r = await net.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  })
  if (!r.ok) throw new Error(`token endpoint ${r.status}: ${await r.text()}`)
  return r.json() as Promise<TokenResponse>
}

async function getJson(url: string, accessToken: string): Promise<{ sub: string; email: string }> {
  const r = await net.fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  if (!r.ok) throw new Error(`userinfo ${r.status}`)
  return r.json() as Promise<{ sub: string; email: string }>
}
