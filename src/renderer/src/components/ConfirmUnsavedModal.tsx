import { useTranslate } from '@renderer/lib/i18n'
import { useEffect } from 'react'
import { useConfirm } from '@renderer/store/useConfirm'

/**
 * In-app modal for the unsaved-changes guard. Driven by the `useConfirm`
 * store (opened via `ask()`), it resolves the pending promise through
 * `answer()`. Esc = cancel, Enter = save.
 */
export default function ConfirmUnsavedModal(): JSX.Element | null {
  const t = useTranslate()
  const open = useConfirm((s) => s.open)
  const answer = useConfirm((s) => s.answer)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') answer('cancel')
      else if (e.key === 'Enter') answer('save')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, answer])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={() => answer('cancel')}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-[26rem] max-w-[90vw] rounded-lg border border-line bg-paper p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-semibold text-ink">{t('Unsaved changes')}</h2>
        <p className="mb-5 text-sm leading-relaxed text-muted">
          {t('Save your changes before continuing?')}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => answer('cancel')}
            className="rounded px-3 py-1.5 text-sm text-ink hover:bg-ink/5"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={() => answer('discard')}
            className="rounded px-3 py-1.5 text-sm text-ink hover:bg-ink/5"
          >
            {t('Don’t Save')}
          </button>
          <button
            onClick={() => answer('save')}
            autoFocus
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-paper hover:opacity-90"
          >
            {t('Save')}
          </button>
        </div>
      </div>
    </div>
  )
}
