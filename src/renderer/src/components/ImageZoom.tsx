import { useEffect, useState } from 'react'
import { IMAGE_ZOOM_EVENT } from '@renderer/components/Editor/livePreview'

interface ZoomState {
  src: string
  alt: string
}

/**
 * Full-window overlay that shows a clicked image at full size. Listens for the
 * `IMAGE_ZOOM_EVENT` dispatched by ImageWidget; closes on click or Escape.
 */
export default function ImageZoom(): JSX.Element | null {
  const [img, setImg] = useState<ZoomState | null>(null)

  useEffect(() => {
    const onZoom = (e: Event): void => {
      const detail = (e as CustomEvent<ZoomState>).detail
      if (detail?.src) setImg(detail)
    }
    window.addEventListener(IMAGE_ZOOM_EVENT, onZoom)
    return () => window.removeEventListener(IMAGE_ZOOM_EVENT, onZoom)
  }, [])

  useEffect(() => {
    if (!img) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setImg(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [img])

  if (!img) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
      onClick={() => setImg(null)}
    >
      <img
        src={img.src}
        alt={img.alt}
        className="max-h-full max-w-full rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
