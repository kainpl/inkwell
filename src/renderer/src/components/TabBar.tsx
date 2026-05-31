import type { MouseEvent } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { closeTabById } from '@renderer/lib/docActions'

/**
 * Open-file tabs. Always visible. Each tab shows the file name, a dirty dot when
 * it has unsaved changes, and a × (revealed on hover) to close it. Click to
 * activate; middle-click or × to close (guarded if dirty).
 */
export default function TabBar(): JSX.Element {
  const tabs = useAppStore((s) => s.tabs)
  const activeId = useAppStore((s) => s.activeId)
  const activateTab = useAppStore((s) => s.activateTab)

  const close = (e: MouseEvent, id: string): void => {
    e.stopPropagation()
    void closeTabById(id)
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-px overflow-x-auto border-b border-line bg-chrome px-1">
      {tabs.map((t) => {
        const active = t.id === activeId
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={active}
            title={t.path ?? t.name}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                void closeTabById(t.id)
              }
            }}
            onClick={() => activateTab(t.id)}
            className={
              'group flex h-7 max-w-[14rem] shrink-0 cursor-pointer items-center gap-1 rounded px-2 text-[13px] ' +
              (active ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:bg-ink/5 hover:text-ink')
            }
          >
            <span className="truncate">{t.name}</span>
            <span className="relative ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              {t.dirty && (
                <span
                  className="absolute h-1.5 w-1.5 rounded-full bg-accent transition-opacity group-hover:opacity-0"
                  aria-label="Unsaved changes"
                />
              )}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => close(e, t.id)}
                title="Close tab"
                aria-label="Close tab"
                className="flex h-4 w-4 items-center justify-center rounded text-sm leading-none text-faint opacity-0 transition-opacity hover:bg-ink/10 hover:text-ink group-hover:opacity-100"
              >
                ×
              </button>
            </span>
          </div>
        )
      })}
    </div>
  )
}
