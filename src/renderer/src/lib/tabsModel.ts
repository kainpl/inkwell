/**
 * Pure helpers for the open-file tab list. A `Tab` is a full document state plus
 * a stable id; the live editor history/cursor for each tab lives in the Editor
 * component (a `Map<id, EditorState>`), not here. Kept dependency-free for tests.
 */

export interface Tab {
  id: string
  path: string | null
  name: string
  content: string
  dirty: boolean
}

/** The already-open tab for a document path (untitled/null paths never match). */
export function findByPath(tabs: Tab[], path: string | null): Tab | undefined {
  return path === null ? undefined : tabs.find((t) => t.path === path)
}

/** A path-less, unmodified tab can be replaced in place when opening a file. */
export function isReplaceable(tab: Tab | undefined): boolean {
  return !!tab && tab.path === null && !tab.dirty
}

/**
 * Close tab `id`: returns the remaining tabs and the id to activate next — the
 * right neighbour, or the new last tab, or null when nothing remains.
 */
export function closeTab(tabs: Tab[], id: string): { tabs: Tab[]; activeId: string | null } {
  const i = tabs.findIndex((t) => t.id === id)
  if (i === -1) return { tabs, activeId: null }
  const rest = tabs.filter((t) => t.id !== id)
  if (rest.length === 0) return { tabs: rest, activeId: null }
  return { tabs: rest, activeId: rest[Math.min(i, rest.length - 1)].id }
}
