import { parseRef } from '@shared/drive'

/**
 * Read/write dispatch over a doc "ref" (the `doc.path` string): a local path
 * goes through the fs IPC, a `gdrive://account/file` URI through the Drive IPC.
 * Keeps the rest of the renderer provider-agnostic.
 */

/** Load a doc by ref. For Drive, also returns name + base modifiedTime. */
export async function readRef(
  path: string
): Promise<{ content: string; name: string; modifiedTime: string }> {
  const ref = parseRef(path)
  if (ref.provider === 'gdrive') {
    const r = await window.api.drive.read(ref.accountId, ref.fileId)
    return { content: r.content, name: r.name, modifiedTime: r.modifiedTime }
  }
  const file = await window.api.readFile(path)
  return { content: file.content, name: file.name, modifiedTime: '' }
}

/** Persist a doc by ref. For Drive, returns the new modifiedTime or a conflict. */
export async function writeRef(
  path: string,
  content: string,
  baseModifiedTime: string
): Promise<{ ok: true; modifiedTime: string } | { ok: false; conflict: true }> {
  const ref = parseRef(path)
  if (ref.provider === 'gdrive') {
    const res = await window.api.drive.write(ref.accountId, ref.fileId, content, baseModifiedTime)
    if ('conflict' in res) return { ok: false, conflict: true }
    return { ok: true, modifiedTime: res.modifiedTime }
  }
  await window.api.saveFile(path, content)
  return { ok: true, modifiedTime: '' }
}
