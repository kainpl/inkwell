import { useCallback } from 'react'

/**
 * A 1px draggable splitter pinned to one edge of its (relatively-positioned)
 * parent panel. While dragging it reports the panel's new pixel width via
 * `onResize`; the parent clamps and persists it. `side` is the edge the handle
 * sits on — 'left' for a panel anchored to the window's right (the outline),
 * 'right' for one anchored to the left (the sidebar).
 */
export default function ResizeHandle({
  side,
  onResize,
  onActive
}: {
  side: 'left' | 'right'
  onResize: (width: number) => void
  onActive?: (active: boolean) => void
}): JSX.Element {
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      const panel = e.currentTarget.parentElement
      if (!panel) return
      const rect = panel.getBoundingClientRect() // fixed edge stays valid through the drag
      onActive?.(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const move = (ev: MouseEvent): void => {
        const width = side === 'right' ? ev.clientX - rect.left : rect.right - ev.clientX
        onResize(width)
      }
      const up = (): void => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        onActive?.(false)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [side, onResize, onActive]
  )

  return (
    <div
      onMouseDown={onMouseDown}
      className={
        'absolute inset-y-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-accent/40 ' +
        (side === 'right' ? 'right-0' : 'left-0')
      }
    />
  )
}
