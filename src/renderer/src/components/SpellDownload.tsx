import { useEffect, useState } from 'react'
import { useT } from '@renderer/lib/i18n'

/** Progress overlay shown while a spell-check dictionary downloads. */
export default function SpellDownload(): JSX.Element | null {
  const [pct, setPct] = useState<number | null>(null)
  const t = useT()

  useEffect(() => window.api.onSpellProgress((p) => setPct(p < 0 ? null : p)), [])

  if (pct === null) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-72 rounded-lg border border-line bg-paper p-4 shadow-xl">
        <div className="mb-2 text-sm text-ink">{t('modal.downloadingDict')}</div>
        <div className="h-2 overflow-hidden rounded bg-ink/10">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
