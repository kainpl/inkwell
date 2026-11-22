import { useTranslate } from '@renderer/lib/i18n'
import { useMemo, useState } from 'react'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'
import { parseOutline } from '@renderer/lib/outline'
import { literalSearch } from '@renderer/lib/folderSearch'
import { GOTO_EVENT } from './Editor/Editor'

export default function OutlinePanel(): JSX.Element {
  const t = useTranslate()
  const content = useAppStore((s) => activeTab(s).doc.content)
  const [query, setQuery] = useState('')

  const headings = useMemo(() => parseOutline(content), [content])
  const pattern = literalSearch(query.trim())
  const results = headings.filter((heading) => pattern.test(heading.text))

  const goto = (offset: number): void => {
    window.dispatchEvent(new CustomEvent<number>(GOTO_EVENT, { detail: offset }))
  }

  return (
    <div className="py-2">
      <div className="sticky top-0 z-[1] bg-chrome px-2 pb-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full min-w-0 rounded border border-line bg-paper px-2 py-1 text-[13px]"
          placeholder={t('Filter headings')}
          aria-label={t('Filter headings')}
        />
      </div>
      {headings.length === 0 ? (
        <div className="px-3 py-2 text-[13px] text-faint">{t('No headings yet.')}</div>
      ) : results.length === 0 ? (
        <div className="px-3 py-2 text-[13px] text-faint" role="status">
          {t('No matches')}
        </div>
      ) : (
        results.map((h) => (
          <button
            key={h.from}
            onClick={() => goto(h.from)}
            className="block w-full whitespace-normal [overflow-wrap:anywhere] rounded px-3 py-1 text-left text-[13px] leading-snug text-ink/75 hover:bg-ink/5 hover:text-ink"
            style={{ paddingLeft: `${(h.level - 1) * 12 + 12}px` }}
            title={h.text}
          >
            {h.text || '—'}
          </button>
        ))
      )}
    </div>
  )
}
