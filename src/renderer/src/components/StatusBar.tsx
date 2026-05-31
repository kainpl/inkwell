import { useMemo } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { computeStats, readingTimeLabel } from '@renderer/lib/textStats'

export default function StatusBar(): JSX.Element {
  const content = useAppStore((s) => s.doc.content)
  const dirty = useAppStore((s) => s.doc.dirty)
  const focusMode = useAppStore((s) => s.focusMode)
  const typewriter = useAppStore((s) => s.typewriterMode)
  const sourceMode = useAppStore((s) => s.sourceMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const toggleTypewriter = useAppStore((s) => s.toggleTypewriter)
  const toggleSourceMode = useAppStore((s) => s.toggleSourceMode)

  const stats = useMemo(() => computeStats(content), [content])

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-chrome px-3 text-[12px] text-faint">
      <div className="flex items-center gap-3">
        <span title="Words">{stats.words} words</span>
        <span title="Characters">{stats.chars} chars</span>
        {stats.readingMinutes > 0 && <span>{readingTimeLabel(stats.readingMinutes)}</span>}
        <span>{dirty ? 'Unsaved' : 'Saved'}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSourceMode}
          title="Show raw Markdown (Ctrl+Shift+E)"
          className={'hover:text-ink ' + (sourceMode ? 'text-accent' : '')}
        >
          Source
        </button>
        <button
          onClick={toggleFocusMode}
          title="Dim all but the active line (Ctrl+Shift+F)"
          className={'hover:text-ink ' + (focusMode ? 'text-accent' : '')}
        >
          Focus
        </button>
        <button
          onClick={toggleTypewriter}
          title="Keep the active line centered (F9)"
          className={'hover:text-ink ' + (typewriter ? 'text-accent' : '')}
        >
          Typewriter
        </button>
      </div>
    </footer>
  )
}
