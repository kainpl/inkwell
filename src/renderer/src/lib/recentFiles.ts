/** Pure management of the "recently opened files" list (newest first). */

const MAX_RECENT = 12

/** Add `path` to the front, de-duplicating and capping the list length. */
export function addRecent(list: string[], path: string, max: number = MAX_RECENT): string[] {
  const next = [path, ...list.filter((p) => p !== path)]
  return next.slice(0, max)
}

/** Remove a path (e.g. when it no longer exists). */
export function removeRecent(list: string[], path: string): string[] {
  return list.filter((p) => p !== path)
}

/** Basename of a path, for menu/labels (handles / and \). */
export function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i >= 0 ? path.slice(i + 1) : path
}
