import { useEffect, useMemo, useState } from 'react'
import { IPC } from '@shared/ipc'
import type { NoteGraph as NoteGraphData } from '@shared/noteGraph'
import { useAppStore } from '@renderer/store/useAppStore'
import { openWikiNote } from '@renderer/lib/wikiNote'

interface Pt {
  x: number
  y: number
  vx: number
  vy: number
}

/** Settle a small force-directed layout (deterministic seed, no animation). */
function layout(data: NoteGraphData): { pos: Map<string, Pt>; box: string } {
  const W = 800
  const H = 600
  const pos = new Map<string, Pt>()
  data.nodes.forEach((n, i) => {
    const a = (i / Math.max(1, data.nodes.length)) * 2 * Math.PI
    pos.set(n.id, { x: W / 2 + Math.cos(a) * 220, y: H / 2 + Math.sin(a) * 180, vx: 0, vy: 0 })
  })
  const ns = data.nodes
  for (let iter = 0; iter < 320; iter++) {
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = pos.get(ns[i].id)!
        const b = pos.get(ns[j].id)!
        let dx = a.x - b.x
        let dy = a.y - b.y
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01
        const f = 6000 / (d * d)
        dx = (dx / d) * f
        dy = (dy / d) * f
        a.vx += dx
        a.vy += dy
        b.vx -= dx
        b.vy -= dy
      }
    }
    for (const e of data.edges) {
      const a = pos.get(e.from)
      const b = pos.get(e.to)
      if (!a || !b) continue
      let dx = b.x - a.x
      let dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = (d - 130) * 0.02
      dx = (dx / d) * f
      dy = (dy / d) * f
      a.vx += dx
      a.vy += dy
      b.vx -= dx
      b.vy -= dy
    }
    for (const n of ns) {
      const p = pos.get(n.id)!
      p.vx += (W / 2 - p.x) * 0.006
      p.vy += (H / 2 - p.y) * 0.006
      p.vx *= 0.85
      p.vy *= 0.85
      p.x += p.vx
      p.y += p.vy
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) return { pos, box: '0 0 800 600' }
  const pad = 60
  return { pos, box: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}` }
}

/** The wiki-link note graph (View ▸ Note Graph…). Click a node to open it. */
export default function NoteGraph(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<NoteGraphData | null>(null)

  useEffect(
    () =>
      window.api.onMenu(IPC.menuNoteGraph, () => {
        const root = useAppStore.getState().root
        if (!root) {
          setData({ nodes: [], edges: [] })
          setOpen(true)
          return
        }
        void window.api.noteGraph(root.path).then((g) => {
          setData(g)
          setOpen(true)
        })
      }),
    []
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const view = useMemo(() => (data ? layout(data) : null), [data])

  if (!open || !data || !view) return null

  const openNote = (id: string): void => {
    setOpen(false)
    void openWikiNote(id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-8"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="text-sm font-semibold text-ink">
            Note Graph <span className="text-faint">({data.nodes.length} notes)</span>
          </span>
          <button onClick={() => setOpen(false)} className="text-faint hover:text-ink">
            ✕
          </button>
        </div>
        {data.nodes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-faint">
            No notes — open a folder with markdown files.
          </div>
        ) : (
          <svg viewBox={view.box} className="min-h-0 flex-1" preserveAspectRatio="xMidYMid meet">
            {data.edges.map((e, i) => {
              const a = view.pos.get(e.from)
              const b = view.pos.get(e.to)
              if (!a || !b) return null
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  style={{ stroke: 'rgb(var(--line))' }}
                  strokeWidth={1.5}
                />
              )
            })}
            {data.nodes.map((n) => {
              const p = view.pos.get(n.id)
              if (!p) return null
              return (
                <g
                  key={n.id}
                  className="cursor-pointer"
                  onClick={() => openNote(n.id)}
                >
                  <circle cx={p.x} cy={p.y} r={7} style={{ fill: 'rgb(var(--accent))' }} />
                  <text
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    style={{ fill: 'rgb(var(--ink))' }}
                    fontSize={13}
                  >
                    {n.label}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
