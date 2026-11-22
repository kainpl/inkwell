import { useState } from 'react'
import { useTranslate } from '@renderer/lib/i18n'
import {
  recentLabels,
  updateRecents,
  useRecents,
  type HistoryChange,
  type RecentKind
} from '@renderer/lib/recents'

export default function RecentSettings({ kind }: { kind: RecentKind }) {
  const t = useTranslate()
  const { limit, paths } = useRecents((s) => s[kind])
  const [error, setError] = useState('')
  async function change(update: HistoryChange) {
    setError('')
    try {
      await updateRecents(update)
    } catch (reason) {
      setError(String(reason))
    }
  }
  return (
    <div role="group" aria-labelledby={`recent-${kind}`}>
      <h2 id={`recent-${kind}`}>{t(recentLabels[kind])}</h2>
      <label className="pref-row">
        {t('Maximum entries')}
        <input
          key={limit}
          type="number"
          min="0"
          max="100"
          step="1"
          defaultValue={limit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          onBlur={(e) => {
            const input = e.currentTarget
            const next = input.valueAsNumber
            input.value = String(limit)
            if (Number.isInteger(next) && next >= 0 && next <= 100 && next !== limit)
              void change({ type: 'limit', kind, limit: next })
          }}
        />
      </label>
      {paths.length ? (
        <>
          <ul>
            {paths.map((path) => (
              <li className="pref-row" key={path}>
                <span className="min-w-0 [overflow-wrap:anywhere]">{path}</span>
                <button
                  className="shrink-0 text-accent"
                  aria-label={t('Remove from list') + ' · ' + path}
                  onClick={() => void change({ type: 'remove', kind, path })}
                >
                  {t('Remove')}
                </button>
              </li>
            ))}
          </ul>
          <button className="pref-reset" onClick={() => void change({ type: 'clear', kind })}>
            {t('Clear list')}
          </button>
        </>
      ) : (
        <p>{t('List is empty')}</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
