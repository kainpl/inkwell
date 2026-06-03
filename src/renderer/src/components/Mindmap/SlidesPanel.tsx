import { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { buildSlides } from '@renderer/lib/mindmap/buildSlides'
import { centerOnNode } from '@renderer/lib/mindmap/canvasViewport'

/** Slides projection: one slide per section node (title + direct-child bullets),
 *  navigable with ◀ / ▶ or ←/→. A read-only view of the one model (like Table). */
export default function SlidesPanel(): JSX.Element {
  const activeId = useAppStore((s) => s.activeId)
  const graph = useProjectGraph(activeId)
  const select = useProjectStore((s) => s.select)
  const slides = graph ? buildSlides(graph) : []
  const [i, setI] = useState(0)
  const idx = Math.min(i, Math.max(0, slides.length - 1))
  const slide = slides[idx]

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, slides.length - 1))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length])

  if (!slide) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-faint">
        Nothing to present yet.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="flex min-h-0 flex-1 flex-col justify-center px-12 py-8">
        <button
          onClick={() => {
            select(slide.id)
            centerOnNode(slide.id)
          }}
          title="Reveal this node on the map"
          className="mb-6 text-left text-3xl font-semibold text-ink hover:text-accent"
        >
          {slide.title}
        </button>
        <ul className="space-y-2 text-lg text-ink">
          {slide.bullets.map((b, j) => (
            <li key={j} className="flex gap-2">
              <span className="text-faint">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[13px]">
        <button
          onClick={() => setI((n) => Math.max(n - 1, 0))}
          disabled={idx === 0}
          className="rounded px-2 py-1 text-ink enabled:hover:bg-line/40 disabled:opacity-40"
        >
          ◀ Prev
        </button>
        <span className="text-faint">
          {idx + 1} / {slides.length}
        </span>
        <button
          onClick={() => setI((n) => Math.min(n + 1, slides.length - 1))}
          disabled={idx >= slides.length - 1}
          className="rounded px-2 py-1 text-ink enabled:hover:bg-line/40 disabled:opacity-40"
        >
          Next ▶
        </button>
      </div>
    </div>
  )
}
