import { useTranslate } from '@renderer/lib/i18n'
import { useMemo } from 'react'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'

function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:['’ʼ-][\p{L}\p{N}]+)*/gu)
  return m ? m.length : 0
}

export default function StatusBar(): JSX.Element {
  const content = useAppStore((s) => activeTab(s).doc.content)
  const dirty = useAppStore((s) => activeTab(s).doc.dirty)
  const focusMode = useAppStore((s) => s.focusMode)
  const typewriter = useAppStore((s) => s.typewriterMode)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)
  const toggleTypewriter = useAppStore((s) => s.toggleTypewriter)

  const words = useMemo(() => countWords(content), [content])
  const t = useTranslate()
  const goal = useAppStore((s) => {
    const { doc, draftGoal } = activeTab(s)
    return doc.path ? s.wordGoals[doc.path] : draftGoal
  })
  const spellError = useAppStore((s) => s.spellCheck && s.spellError)
  const chars = content.length

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-chrome px-3 text-[12px] text-faint">
      <div className="flex items-center gap-3">
        <span>
          {t('Words')} {words}
          {goal ? ' / ' + goal : ''}
        </span>
        <span>
          {t('Characters')} {chars}
        </span>
        {spellError && (
          <span role="alert" title={spellError}>
            {t('Spelling check failed')}
          </span>
        )}
        <span>{t(dirty ? 'Unsaved' : 'Saved')}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleFocusMode}
          className={'hover:text-ink ' + (focusMode ? 'text-accent' : '')}
        >
          {t('Focus')}
        </button>
        <button
          onClick={toggleTypewriter}
          className={'hover:text-ink ' + (typewriter ? 'text-accent' : '')}
        >
          {t('Typewriter')}
        </button>
      </div>
    </footer>
  )
}
