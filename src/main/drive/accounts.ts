import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { DriveAccount } from '../../shared/drive'

/**
 * Persistence for connected Google accounts. Refresh tokens are encrypted with
 * the OS keychain via `safeStorage`; access tokens are never persisted (held in
 * memory by the DriveService). The file lives in userData.
 */

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
