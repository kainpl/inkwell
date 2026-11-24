import { useEffect, useState, type ReactNode } from 'react'
import { message } from '@tauri-apps/plugin-dialog'
import { openPath } from '@renderer/lib/docActions'
import { searchFolder, type FolderMatch } from '@renderer/lib/folderSearch'
import { useTranslate } from '@renderer/lib/i18n'
import { GOTO_EVENT } from './Editor/Editor'

export default function FolderSearch({ path, children }: { path: string; children: ReactNode }) {
  const t = useTranslate()
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<FolderMatch[]>([])
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof searchFolder>>>()
  const [error, setError] = useState('')
  const term = query.trim()

  useEffect(() => {
    if (!term) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const result = await searchFolder(path, term, controller.signal, (batch) => {
          setMatches((current) => [...current, ...batch])
        })
        if (!controller.signal.aborted) setSummary(result)
      } catch (reason) {
        if (!controller.signal.aborted) setError(String(reason))
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [path, term])

  async function reveal(match: FolderMatch) {
    try {
      await openPath(match.path)
      window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: { ...match, query: term } }))
    } catch (reason) {
      await message(String(reason), { title: 'Inkwell', kind: 'error' })
    }
  }

  return (
    <>
      <div className="sticky top-0 z-[1] bg-chrome p-2">
        <input
          type="search"
          value={query}
          placeholder={t('Search folder contents')}
          aria-label={t('Search folder contents')}
          className="w-full min-w-0 rounded border border-line bg-paper px-2 py-1 text-[13px]"
          onChange={(event) => {
            const value = event.target.value
            setQuery(value)
            if (value.trim() !== term) {
              setMatches([])
              setSummary(undefined)
              setError('')
            }
          }}
        />
      </div>
      <div hidden={!!term}>{children}</div>
      {term && (
        <div className="px-2 pb-2 text-[13px]">
          <p className="px-1 pb-1 text-xs text-muted" role="status">
            {error
              ? t('Folder search failed')
              : !summary
                ? t('Searching…')
                : summary.limited
                  ? t('Showing first {count} matching lines').replace(
                      '{count}',
                      String(summary.count)
                    )
                  : summary.count
                    ? t('Matching lines: {count}').replace('{count}', String(summary.count))
                    : t('No matches')}
          </p>
          {error && <p className="break-words px-1 pb-1 text-muted">{error}</p>}
          {!!summary?.skipped && (
            <p className="px-1 pb-1 text-xs text-muted">
              {t('Unreadable files or folders: {count}').replace(
                '{count}',
                String(summary.skipped)
              )}
            </p>
          )}
          <ul>
            {matches.map((match) => (
              <li key={match.path + ':' + match.line}>
                <button
                  type="button"
                  title={match.path}
                  onClick={() => void reveal(match)}
                  className="block w-full rounded px-2 py-1 text-left hover:bg-ink/5"
                >
                  <span className="block truncate text-xs text-accent">
                    {match.path.slice(path.length).replace(/^[\\/]/, '')}:{match.line}
                  </span>
                  <span className="block truncate text-ink/80">{match.preview}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
