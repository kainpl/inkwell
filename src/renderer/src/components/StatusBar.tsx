import { useMemo } from 'react'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import { computeStats, readingTimeLabel } from '@renderer/lib/textStats'
import { useT } from '@renderer/lib/i18n'

export default function StatusBar(): JSX.Element {
  const content = useAppStore((s) => s.doc.content)
  const dirty = useAppStore((s) => s.doc.dirty)
  const focusMode = useAppStore((s) => s.focusMode)
  const typewriter = useAppStore((s) => s.typewriterMode)
  const sourceMode = useAppStore((s) => s.sourceMode)
  const autoSave = useAppStore((s) => s.autoSave)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const toggleTypewriter = useAppStore((s) => s.toggleTypewriter)
  const toggleSourceMode = useAppStore((s) => s.toggleSourceMode)
  const toggleAutoSave = useAppStore((s) => s.toggleAutoSave)

  const gitBranch = useAppStore((s) => s.gitBranch)
  const t = useT()

  const stats = useMemo(() => computeStats(content), [content])

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-chrome px-3 text-[12px] text-faint">
      <div className="flex items-center gap-3">
        {gitBranch && (
          <button
            onClick={() => window.api.triggerMenu(IPC.menuSourceControl)}
            title={t('status.sourceControlTitle')}
            className="flex items-center gap-1 hover:text-ink"
          >
            <span>⎇ {gitBranch.branch}</span>
            {gitBranch.ahead > 0 && <span>↑{gitBranch.ahead}</span>}
            {gitBranch.behind > 0 && <span>↓{gitBranch.behind}</span>}
          </button>
        )}
        <span>{t('status.words', { n: stats.words })}</span>
        <span>{t('status.chars', { n: stats.chars })}</span>
        {stats.readingMinutes > 0 && <span>{readingTimeLabel(stats.readingMinutes)}</span>}
        <span>{dirty ? t('status.unsaved') : t('status.saved')}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleAutoSave}
          title={t('status.autoSaveTitle')}
          className={'hover:text-ink ' + (autoSave ? 'text-accent' : '')}
        >
          {t('status.autoSave')}
        </button>
        <button
          onClick={toggleSourceMode}
          title={t('status.sourceTitle')}
          className={'hover:text-ink ' + (sourceMode ? 'text-accent' : '')}
        >
          {t('status.source')}
        </button>
        <button
          onClick={toggleFocusMode}
          title={t('status.focusTitle')}
          className={'hover:text-ink ' + (focusMode ? 'text-accent' : '')}
        >
          {t('status.focus')}
        </button>
        <button
          onClick={toggleTypewriter}
          title={t('status.typewriterTitle')}
          className={'hover:text-ink ' + (typewriter ? 'text-accent' : '')}
        >
          {t('status.typewriter')}
        </button>
      </div>
    </footer>
  )
}
