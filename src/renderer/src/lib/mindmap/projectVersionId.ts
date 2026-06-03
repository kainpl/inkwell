/**
 * A stable, filesystem-safe version-history id for a project, derived from its source
 * path (reuses the markdown editor's `saveVersion`/`listVersions`/`readVersion` store,
 * which folders by id and validates `/^[A-Za-z0-9_-]{1,128}$/`). Untitled projects
 * (empty srcPath) aren't versioned → null.
 */
export function projectVersionId(srcPath: string): string | null {
  if (!srcPath) return null
  let h = 5381
  for (let i = 0; i < srcPath.length; i++) h = (((h << 5) + h) ^ srcPath.charCodeAt(i)) | 0
  return `proj-${(h >>> 0).toString(36)}`
}
