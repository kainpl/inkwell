import * as Bar from '@radix-ui/react-menubar'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { menuGroups, type DesktopActions, type MenuEntry } from '@renderer/desktop/menu'
import { useTranslate } from '@renderer/lib/i18n'
import { recentLabels, useRecents } from '@renderer/lib/recents'
import { shortcutLabel, type Command } from '@renderer/lib/shortcuts'
import { useAppStore } from '@renderer/store/useAppStore'
import { useConfirm } from '@renderer/store/useConfirm'

const compactQuery = '(max-width: 640px)'
function watchWidth(notify: () => void) {
  const query = window.matchMedia(compactQuery)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}

export default function AppMenu({ actions }: { actions: DesktopActions }) {
  const compact = useSyncExternalStore(watchWidth, () => window.matchMedia(compactQuery).matches)
  const t = useTranslate()
  const shortcuts = useAppStore((s) => s.shortcuts)
  const recents = useRecents()
  const bar = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLElement | null>(null)
  const selected = useRef(false)

  function remember(target: EventTarget | null) {
    if (target instanceof HTMLElement && !target.closest('[data-app-menu]'))
      previous.current = target
  }
  useEffect(() => {
    function focusMenu(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.key !== 'F10' ||
        event.shiftKey ||
        event.ctrlKey ||
        event.altKey ||
        useAppStore.getState().preferencesOpen ||
        useConfirm.getState().open
      )
        return
      const trigger = [
        ...(bar.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
      ].find((b) => b.offsetWidth > 0)
      if (trigger) {
        event.preventDefault()
        trigger.focus()
      }
    }
    window.addEventListener('keydown', focusMenu)
    return () => window.removeEventListener('keydown', focusMenu)
  }, [])

  function select(run: () => Promise<void>) {
    selected.current = true
    const target = previous.current
    if (target?.isConnected && target !== document.body) target.focus({ preventScroll: true })
    else document.querySelector<HTMLElement>('.cm-content')?.focus({ preventScroll: true })
    void run()
  }
  function item(entry: MenuEntry, index: number) {
    if (entry === '-') return <Bar.Separator key={index} className="app-menu-separator" />
    if (entry === 'files' || entry === 'folders') {
      const paths = recents[entry].paths
      return (
        <Bar.Sub key={entry}>
          <Bar.SubTrigger className="app-menu-item" disabled={!paths.length}>
            {t(recentLabels[entry])}
            <span aria-hidden="true">›</span>
          </Bar.SubTrigger>
          <Bar.Portal>
            <Bar.SubContent data-app-menu className="app-menu-popup" collisionPadding={5}>
              {paths.map((path) => (
                <Bar.Item
                  className="app-menu-item recent-path"
                  key={path}
                  title={path}
                  onSelect={() => select(() => actions.recent(entry, path))}
                >
                  {path}
                </Bar.Item>
              ))}
            </Bar.SubContent>
          </Bar.Portal>
        </Bar.Sub>
      )
    }
    const fixed = { Cut: 'Ctrl+X', Copy: 'Ctrl+C', Paste: 'Ctrl+V', 'Select all': 'Ctrl+A' }
    const shortcut = shortcuts[entry as Command] ?? fixed[entry as keyof typeof fixed]
    return (
      <Bar.Item
        className="app-menu-item"
        key={entry}
        onSelect={() => select(() => actions.run(entry))}
      >
        {t(entry === 'Close' ? 'Close tab' : entry)}
        {shortcut && <kbd>{shortcutLabel(shortcut)}</kbd>}
      </Bar.Item>
    )
  }
  const groups = Object.entries(menuGroups)
  function menu(label: string, children: React.ReactNode) {
    return (
      <Bar.Menu key={label}>
        <Bar.Trigger className="app-menu-trigger">{t(label)}</Bar.Trigger>
        <Bar.Portal>
          <Bar.Content
            data-app-menu
            className="app-menu-popup"
            align="start"
            sideOffset={4}
            collisionPadding={5}
            onCloseAutoFocus={(event) => {
              if (selected.current) {
                event.preventDefault()
                selected.current = false
              }
            }}
          >
            {children}
          </Bar.Content>
        </Bar.Portal>
      </Bar.Menu>
    )
  }
  return (
    <Bar.Root
      ref={bar}
      data-app-menu
      className="app-menubar"
      aria-label={t('Menu')}
      onPointerDownCapture={() => remember(document.activeElement)}
      onFocusCapture={(e) => remember(e.relatedTarget)}
    >
      {compact
        ? menu(
            'Menu',
            groups.map(([label, entries]) => (
              <Bar.Sub key={label}>
                <Bar.SubTrigger className="app-menu-item">
                  {t(label)}
                  <span aria-hidden="true">›</span>
                </Bar.SubTrigger>
                <Bar.Portal>
                  <Bar.SubContent data-app-menu className="app-menu-popup" collisionPadding={5}>
                    {entries.map(item)}
                  </Bar.SubContent>
                </Bar.Portal>
              </Bar.Sub>
            ))
          )
        : groups.map(([label, entries]) => menu(label, entries.map(item)))}
    </Bar.Root>
  )
}
