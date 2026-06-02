import { useEffect, useMemo, useRef, useState } from 'react'
import { IPC } from '@shared/ipc'
import { fuzzyFilter } from '@renderer/lib/fuzzy'
import { COMMANDS, categoryKey, type Command } from '@renderer/lib/commands'
import { useT } from '@renderer/lib/i18n'
import { translate } from '@shared/i18n'
import { useAppStore } from '@renderer/store/useAppStore'

/**
 * Command palette (Ctrl/Cmd+Shift+P). Fuzzy-search every app command and run it
 * with Enter. Each command re-fires its existing menu channel via
 * window.api.triggerMenu, so it behaves exactly like clicking the native menu.
 */
export default function CommandPalette(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useT()
  const locale = useAppStore((s) => s.locale)

  useEffect(() => {
    return window.api.onMenu(IPC.menuCommandPalette, () => {
      setQuery('')
      setIndex(0)
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Search the localized title + category (plus the English source) so the
  // palette is findable in any active language and still matches English terms.
  const results = useMemo(() => {
    const search = (c: Command): string =>
      `${translate(locale, categoryKey(c))} ${translate(locale, c.titleKey)} ${c.category} ${c.title}`
    return fuzzyFilter(COMMANDS, query, search).slice(0, 50)
  }, [query, locale])

  if (!open) return null

  const run = (cmd: Command | undefined): void => {
    setOpen(false)
    if (cmd) window.api.triggerMenu(cmd.channel, cmd.arg)
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(results[index])
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-[34rem] max-w-[90vw] overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={onKey}
          placeholder={t('cmd.placeholder')}
          className="w-full border-b border-line bg-paper px-3 py-2 text-sm text-ink outline-none"
        />
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-faint">{t('cmd.noMatch')}</div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(c)}
                className={
                  'flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm ' +
                  (i === index ? 'bg-accent/10 text-accent' : 'text-ink/80')
                }
              >
                <span className="w-16 shrink-0 truncate text-[11px] text-faint">{t(categoryKey(c))}</span>
                <span className="truncate">{t(c.titleKey)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
