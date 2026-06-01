import { isConflict, type DriveAccount, type DriveNode } from '../../shared/drive'
import * as accounts from './accounts'
import * as oauth from './oauth'
import * as api from './api'

/**
 * Ties accounts + OAuth + REST together. Holds in-memory access tokens (never
 * persisted) and an optional BYO client id that overrides the built-in one.
 */
class DriveService {
  private tokens = new Map<string, { accessToken: string; expiresAt: number }>()
  private byoClientId: string | null = null
  private byoClientSecret: string | null = null

  setCredentials(id: string | null, secret: string | null): void {
    this.byoClientId = id && id.trim() ? id.trim() : null
    this.byoClientSecret = secret && secret.trim() ? secret.trim() : null
  }

  private creds(): { clientId: string; clientSecret: string } {
    return {
      clientId: this.byoClientId || oauth.BUILTIN_CLIENT_ID,
      clientSecret: this.byoClientSecret || oauth.BUILTIN_CLIENT_SECRET
    }
  }

  list(): Promise<DriveAccount[]> {
    return accounts.listAccounts()
  }

  async connect(): Promise<DriveAccount> {
    const { clientId, clientSecret } = this.creds()
    if (!clientId) throw new Error('No Google client id configured. Set one in Preferences ▸ Cloud.')
    const r = await oauth.connect(clientId, clientSecret)
    await accounts.upsertAccount(r.accountId, r.email, clientId, clientSecret, r.refreshToken)
    this.tokens.set(r.accountId, { accessToken: r.accessToken, expiresAt: r.expiresAt })
    return { accountId: r.accountId, email: r.email }
  }

  async disconnect(accountId: string): Promise<void> {
    this.tokens.delete(accountId)
    await accounts.removeAccount(accountId)
  }

  /** Return a fresh access token for an account, refreshing if needed. */
  private async token(accountId: string): Promise<string> {
    const cached = this.tokens.get(accountId)
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.accessToken
    const secret = await accounts.accountSecret(accountId)
    if (!secret) throw new Error('Account not connected.')
    const fresh = await oauth.refresh(secret.clientId, secret.clientSecret, secret.refreshToken)
    this.tokens.set(accountId, fresh)
    return fresh.accessToken
  }

  async listFolder(accountId: string, folderId: string): Promise<DriveNode[]> {
    return api.list(await this.token(accountId), folderId || 'root')
  }

  async read(
    accountId: string,
    fileId: string
  ): Promise<{ content: string; modifiedTime: string; name: string }> {
    const token = await this.token(accountId)
    const [content, m] = await Promise.all([api.read(token, fileId), api.meta(token, fileId)])
    return { content, modifiedTime: m.modifiedTime, name: m.name }
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
