export interface FolderMatch {
  path: string
  line: number
  column: number
  preview: string
}

export const folderResultLimit = 500

export function literalSearch(query: string): RegExp {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu')
}

export async function searchFolder(
  path: string,
  query: string,
  signal: AbortSignal,
  onMatches: (matches: FolderMatch[]) => void
): Promise<{ count: number; skipped: number; limited: boolean }> {
  const pattern = literalSearch(query)
  const pending = [path]
  let count = 0
  let skipped = 0
  while (pending.length && !signal.aborted) {
    const folder = pending.pop()!
    let entries
    try {
      entries = await window.api.readDir(folder)
    } catch (error) {
      if (folder === path) throw error
      skipped++
      continue
    }
    for (const entry of entries) {
      if (signal.aborted) break
      if (entry.type === 'directory') {
        pending.push(entry.path)
        continue
      }
      let content
      try {
        content = await window.api.readDocumentText(entry.path)
      } catch {
        skipped++
        continue
      }
      if (signal.aborted) break
      const matches: FolderMatch[] = []
      const lines = content.split(/\r\n?|\n/)
      for (const [index, line] of lines.entries()) {
        const match = pattern.exec(line)
        if (!match) continue
        if (count === folderResultLimit) {
          if (matches.length) onMatches(matches)
          return { count, skipped, limited: true }
        }
        const start = Math.max(0, match.index - 40)
        const end = Math.min(line.length, match.index + Math.max(match[0].length, 80))
        matches.push({
          path: entry.path,
          line: index + 1,
          column: match.index,
          preview:
            (start ? '…' : '') + line.slice(start, end).trim() + (end < line.length ? '…' : '')
        })
        count++
      }
      if (matches.length) onMatches(matches)
    }
  }
  return { count, skipped, limited: false }
}
