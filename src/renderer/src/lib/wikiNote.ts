import { useAppStore } from '@renderer/store/useAppStore'
import { openPath } from './docActions'

/**
 * Open the workspace note a wiki-link `[[name]]` points at: a `.md` whose
 * basename matches (case-insensitive). If none exists, create it in the
 * workspace root and open it. No-op without an open folder.
 */
export async function openWikiNote(name: string): Promise<void> {
  const root = useAppStore.getState().root
  if (!root) return
  const target = name.trim().replace(/\.md$/i, '')
  if (!target) return

  const articles = await window.api.listArticles(root.path)
  const match = articles.find((a) => a.name.replace(/\.md$/i, '').toLowerCase() === target.toLowerCase())
  if (match) {
    void openPath(match.path)
    return
  }
  const created = await window.api.createFile(root.path, `${target}.md`)
  if (created) void openPath(created)
}
