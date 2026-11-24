import { useLayoutEffect, useRef } from 'react'
import { message } from '@tauri-apps/plugin-dialog'
import { closeTab, newDocument } from '@renderer/lib/docActions'
import { useTranslate } from '@renderer/lib/i18n'
import { useAppStore } from '@renderer/store/useAppStore'

export default function DocumentTabs() {
  const t = useTranslate()
  const tabs = useAppStore((s) => s.tabs)
  const active = useAppStore((s) => s.documentId)
  const activate = useAppStore((s) => s.activateTab)
  const selected = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    selected.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [active])

  return (
    <div className="flex min-w-0 shrink-0 items-stretch border-b border-line bg-chrome text-[13px]">
      <div
        role="tablist"
        aria-label={t('Open documents')}
        className="flex min-h-8 min-w-0 overflow-x-auto"
      >
        {tabs.map(({ id, doc, externalChange }, index) => {
          const close = () =>
            void closeTab(id).catch((error) =>
              message(String(error), { title: 'Inkwell', kind: 'error' })
            )
          return (
            <div
              key={id}
              className={
                'group flex max-w-56 shrink-0 items-center border-r border-line ' +
                (id === active
                  ? 'bg-paper shadow-[inset_0_-2px_rgb(var(--accent))]'
                  : 'text-muted hover:bg-ink/5')
              }
            >
              <button
                id={'document-tab-' + id}
                ref={id === active ? selected : undefined}
                type="button"
                role="tab"
                aria-selected={id === active}
                aria-controls="document-editor"
                tabIndex={id === active ? 0 : -1}
                title={doc.path ?? doc.name}
                className="flex min-w-0 items-center gap-1.5 px-3 py-1.5"
                onClick={() => activate(id)}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault()
                    close()
                  }
                }}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : event.key === 'ArrowLeft'
                          ? (index - 1 + tabs.length) % tabs.length
                          : event.key === 'ArrowRight'
                            ? (index + 1) % tabs.length
                            : -1
                  if (next === -1) return
                  event.preventDefault()
                  activate(tabs[next].id)
                  document.getElementById('document-tab-' + tabs[next].id)?.focus()
                }}
              >
                {(doc.dirty || externalChange) && (
                  <span
                    title={t('Unsaved changes')}
                    aria-label={t('Unsaved changes')}
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  />
                )}
                <span className="truncate">{doc.name}</span>
              </button>
              <button
                type="button"
                className="mr-1 h-6 w-6 shrink-0 rounded text-muted hover:bg-ink/10 hover:text-ink"
                aria-label={t('Close tab') + ' · ' + doc.name}
                title={t('Close tab')}
                onClick={close}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="w-8 shrink-0 text-lg leading-none text-muted hover:bg-ink/5 hover:text-ink"
        aria-label={t('New')}
        title={t('New')}
        onClick={newDocument}
      >
        +
      </button>
    </div>
  )
}
