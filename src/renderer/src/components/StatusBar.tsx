import { useMemo } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'

function countWords(text: string): number {
  const m = text.trim().match(/\S+/g)
  return m ? m.length : 0
}

export default function StatusBar(): JSX.Element {
  const content = useAppStore((s) => s.doc.content)
  const dirty = useAppStore((s) => s.doc.dirty)
  const focusMode = useAppStore((s) => s.focusMode)
  const typewriter = useAppStore((s) => s.typewriterMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const toggleTypewriter = useAppStore((s) => s.toggleTypewriter)

  const words = useMemo(() => countWords(content), [content])
  const chars = content.length

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-chrome px-3 text-[12px] text-faint">
      <div className="flex items-center gap-3">
        <span>{words} words</span>
        <span>{chars} chars</span>
        <span>{dirty ? 'Unsaved' : 'Saved'}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleFocusMode}
          className={'hover:text-ink ' + (focusMode ? 'text-accent' : '')}
        >
          Focus
        </button>
        <button
          onClick={toggleTypewriter}
          className={'hover:text-ink ' + (typewriter ? 'text-accent' : '')}
        >
          Typewriter
        </button>
      </div>
    </footer>
  )
}
