import { useTranslate } from '@renderer/lib/i18n'
import { useMemo } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { parseOutline } from '@renderer/lib/outline'
import { GOTO_EVENT } from './Editor/Editor'

export default function OutlinePanel(): JSX.Element {
  const t = useTranslate()
  const open = useAppStore((s) => s.outlineOpen)
  const content = useAppStore((s) => s.doc.content)

  const headings = useMemo(() => parseOutline(content), [content])

  const goto = (offset: number): void => {
    window.dispatchEvent(new CustomEvent<number>(GOTO_EVENT, { detail: offset }))
  }

  return (
    <aside
      className={
        'h-full shrink-0 overflow-y-auto border-l border-line bg-chrome ' +
        'transition-all duration-200 ' +
        (open ? 'w-64' : 'w-0 overflow-hidden border-l-0')
      }
    >
      {open && (
        <div className="py-2">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
            {t('Outline')}
          </div>
          {headings.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-faint">{t('No headings yet.')}</div>
          ) : (
            headings.map((h, i) => (
              <button
                key={i}
                onClick={() => goto(h.from)}
                className="block w-full truncate rounded px-3 py-1 text-left text-[13px] text-ink/75 hover:bg-ink/5 hover:text-ink"
                style={{ paddingLeft: `${(h.level - 1) * 12 + 12}px` }}
                title={h.text}
              >
                {h.text || '—'}
              </button>
            ))
          )}
        </div>
      )}
    </aside>
  )
}
