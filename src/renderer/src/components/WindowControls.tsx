import { useEffect, useRef, useState } from 'react'
import { changePadding, isAttached } from 'tauri-plugin-snap-layout'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useTranslate } from '@renderer/lib/i18n'
import type { DesktopActions } from '@renderer/desktop/menu'

export default function WindowControls({ actions }: { actions: DesktopActions }) {
  const t = useTranslate()
  const [maximized, setMaximized] = useState(false)
  const maximizeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const win = getCurrentWindow()
    let active = true
    const refresh = async () => {
      const [value, scale] = await Promise.all([win.isMaximized(), win.scaleFactor()])
      if (!active) return
      setMaximized(value)
      const rect = maximizeButton.current?.getBoundingClientRect()
      if (!rect || !isAttached()) return
      // The plugin converts CSS coordinates using only the monitor DPI.
      // Account for WebView zoom as well, including the button's offset.
      const zoom = window.devicePixelRatio / scale
      const left = Math.round(rect.left) - Math.round(rect.left * zoom)
      const top = Math.round(rect.top) - Math.round(rect.top * zoom)
      changePadding({
        left,
        top,
        right: Math.round(rect.width * zoom) - Math.round(rect.width) - left,
        bottom: Math.round(rect.height * zoom) - Math.round(rect.height) - top
      })
    }
    const observer = new ResizeObserver(refresh)
    observer.observe(document.documentElement)
    observer.observe(maximizeButton.current!)
    const subscription = win.onScaleChanged(refresh)
    return () => {
      active = false
      observer.disconnect()
      void subscription.then((unlisten) => unlisten())
    }
  }, [])

  return (
    <div className="window-controls">
      {(['Minimize', 'Maximize', 'Close'] as const).map((action) => {
        const label = t(action === 'Maximize' && maximized ? 'Restore window' : action)
        return (
          <button
            type="button"
            key={action}
            aria-label={label}
            title={label}
            id={'window-' + action.toLowerCase()}
            ref={action === 'Maximize' ? maximizeButton : undefined}
            onClick={() => void actions.run(action)}
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              {action === 'Minimize' ? (
                <path d="M3 8.5h10" />
              ) : action === 'Close' ? (
                <path d="m3.5 3.5 9 9m0-9-9 9" />
              ) : maximized ? (
                <path d="M5.5 3.5v-1h8v8h-1m-10-5h8v8h-8z" />
              ) : (
                <rect x="3.5" y="3.5" width="9" height="9" />
              )}
            </svg>
          </button>
        )
      })}
    </div>
  )
}
