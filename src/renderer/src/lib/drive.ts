import { gdriveRef, type DriveNode } from '@shared/drive'
import { useAppStore } from '@renderer/store/useAppStore'

/**
 * Renderer-side Google Drive actions. Token/network work happens in main; this
 * is the thin layer the UI calls. A module-level map remembers the
 * `modifiedTime` each open Drive doc was loaded at (keyed by its gdrive:// path)
 * for the save-time conflict check — kept here rather than on the doc/tab to
 * avoid threading it through every doc mutation.
 */

const baseTimes = new Map<string, string>()

export function setDriveBase(path: string, time: string): void {
  if (time) baseTimes.set(path, time)
}
export function getDriveBase(path: string): string {
  return baseTimes.get(path) ?? ''
}

/** Window event that opens the connect modal (from buttons that aren't menus). */
export const DRIVE_CONNECT_EVENT = 'ink:drive-connect'
export function triggerConnect(): void {
  window.dispatchEvent(new Event(DRIVE_CONNECT_EVENT))
}

export async function refreshAccounts(): Promise<void> {
  useAppStore.getState().setDriveAccounts(await window.api.drive.listAccounts().catch(() => []))
}

export async function connectAccount(): Promise<{ ok: boolean; error?: string }> {
  try {
    await window.api.drive.connect()
    await refreshAccounts()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
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
  const path = gdriveRef(accountId, node.id)
  setDriveBase(path, modifiedTime)
  useAppStore.getState().openInTab({ path, name: node.name, content })
}
