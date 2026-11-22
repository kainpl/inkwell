import { useTranslate } from '@renderer/lib/i18n'
import { useMemo } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { parseOutline } from '@renderer/lib/outline'
import { GOTO_EVENT } from './Editor/Editor'

export default function OutlinePanel(): JSX.Element {
  const t = useTranslate()
  const content = useAppStore((s) => s.doc.content)

  const headings = useMemo(() => parseOutline(content), [content])

  const goto = (offset: number): void => {
    window.dispatchEvent(new CustomEvent<number>(GOTO_EVENT, { detail: offset }))
  }

  return (
    <div className="py-2">
      {headings.length === 0 ? (
        <div className="px-3 py-2 text-[13px] text-faint">{t('No headings yet.')}</div>
      ) : (
        headings.map((h, i) => (
          <button
            key={i}
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
