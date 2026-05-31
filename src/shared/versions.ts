/**
 * Pure helpers for the local version history ("Browse All Versions").
 * Shared by the main process (storage + pruning) and the renderer (snapshot
 * decisions) so the rules live in one dependency-free, tested place.
 */

/** Max snapshots kept per document; older ones are pruned on each new save. */
export const MAX_VERSIONS = 50

/**
 * Whether `content` is worth snapshotting: it must be non-empty and differ
 * from the latest existing snapshot (`latest` is null when there is none), so
 * repeated saves of identical text don't pile up duplicate versions.
 */
export function shouldSnapshot(content: string, latest: string | null): boolean {
  if (content.trim() === '') return false
  return content !== latest
}

/**
 * Given the timestamps of existing snapshots, return the ones to delete so that
 * at most `cap` remain (oldest pruned first). Empty when already within `cap`.
 */
export function versionsToPrune(savedAts: number[], cap: number): number[] {
  if (savedAts.length <= cap) return []
  const oldestFirst = [...savedAts].sort((a, b) => a - b)
  return oldestFirst.slice(0, oldestFirst.length - cap)
}
