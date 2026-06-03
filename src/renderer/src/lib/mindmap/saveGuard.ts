/**
 * Shrink-guard: a pure heuristic that flags a catastrophic node-count drop so an
 * **auto**-save never silently overwrites a project with a near-empty one (e.g.
 * after a bug wipes the model). Explicit Save always bypasses this — a deliberate
 * deletion is the user's call. Tiny docs are exempt (deleting most of 3 nodes is normal).
 */
export function isCatastrophicShrink(prev: number, next: number): boolean {
  if (prev < 10) return false
  return next < prev * 0.5 && prev - next >= 10
}
