import { message } from '@tauri-apps/plugin-dialog'
import { reloadFromDisk, saveDocAs } from '@renderer/lib/docActions'
import { useTranslate } from '@renderer/lib/i18n'
import { activeTab, useAppStore } from '@renderer/store/useAppStore'

export default function ExternalChangeNotice() {
  const t = useTranslate()
  const externalChange = useAppStore((s) => activeTab(s).externalChange)
  if (!externalChange) return null

  const report = (error: unknown) => message(String(error), { title: 'Inkwell', kind: 'error' })
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-chrome px-3 py-2 text-sm">
      <p className="mr-auto" role="status">
        {t('The file changed on disk while you were editing.')}
      </p>
      <button
        className="rounded px-2 py-1 text-accent hover:bg-ink/5"
        onClick={() => void saveDocAs().catch(report)}
      >
        {t('Save As…')}
      </button>
      <button
        className="rounded px-2 py-1 hover:bg-ink/5"
        onClick={() => void reloadFromDisk().catch(report)}
      >
        {t('Discard edits and reload')}
      </button>
    </div>
  )
}
