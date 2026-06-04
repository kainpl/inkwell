import { useEffect, useRef } from 'react'
import { type TextStats, readingTimeLabel, goalProgress } from '@renderer/lib/textStats'
import { useT } from '@renderer/lib/i18n'

/**
 * Detailed word-count card shown above the status-bar count. Lists every stat
 * `computeStats` produces plus, when a word goal is set, a progress bar.
 * Closes on outside-click / Esc.
 */
export default function WordCountPopover({
  stats,
  goal,
  onClose
}: {
  stats: TextStats
  goal: number | null
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const progress = goalProgress(stats.words, goal)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const rows: [string, string | number][] = [
    [t('wc.words'), stats.words],
    [t('wc.chars'), stats.chars],
    [t('wc.charsNoSpaces'), stats.charsNoSpaces],
    [t('wc.lines'), stats.lines],
    [t('wc.reading'), readingTimeLabel(stats.readingMinutes) || '—']
  ]

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-30 mb-1 w-56 rounded-md border border-line bg-paper p-2 text-[12px] text-ink shadow-lg"
    >
      <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
        {t('wc.title')}
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between px-1 py-0.5">
          <span className="text-faint">{label}</span>
          <span className="tabular-nums">{value}</span>
        </div>
      ))}
      {progress && goal && (
        <div className="mt-1.5 border-t border-line px-1 pt-1.5">
          <div className="flex justify-between">
            <span className="text-faint">{t('wc.goal')}</span>
            <span className="tabular-nums">
              {stats.words} / {goal}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className={'h-full rounded-full ' + (progress.done ? 'bg-emerald-500' : 'bg-accent')}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div className="mt-1 text-right text-[11px] text-faint">
            {progress.done ? t('wc.goalDone') : `${progress.pct}%`}
          </div>
        </div>
      )}
    </div>
  )
}
