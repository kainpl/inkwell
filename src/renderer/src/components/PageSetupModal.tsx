import { useEffect, useState, type ReactNode } from 'react'
import { IPC } from '@shared/ipc'
import { useAppStore } from '@renderer/store/useAppStore'
import type { Paper } from '@renderer/lib/pageSetup'

const FIELD = 'rounded border border-line bg-paper px-2 py-1 text-sm text-ink'

function Row({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </label>
  )
}

/** Page Setup dialog for Print / Export PDF (File → Page Setup…). */
export default function PageSetupModal(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const setup = useAppStore((s) => s.pageSetup)
  const setPageSetup = useAppStore((s) => s.setPageSetup)

  useEffect(() => window.api.onMenu(IPC.menuPageSetup, () => setOpen(true)), [])
  useEffect(() => {
    const open = (): void => setOpen(true)
    window.addEventListener('ink:open-page-setup', open)
    return () => window.removeEventListener('ink:open-page-setup', open)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-[24rem] max-w-[92vw] rounded-lg border border-line bg-paper p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-semibold text-ink">Page Setup</h2>

        <Row label="Paper">
          <select
            className={FIELD}
            value={setup.paper}
            onChange={(e) => setPageSetup({ paper: e.target.value as Paper })}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="A5">A5</option>
            <option value="Custom">Custom</option>
          </select>
        </Row>

        {setup.paper === 'Custom' && (
          <Row label="Size (mm)">
            <input
              type="number"
              className={`${FIELD} w-20`}
              value={setup.customW}
              onChange={(e) => setPageSetup({ customW: Number(e.target.value) || 0 })}
            />
            <span className="text-faint">×</span>
            <input
              type="number"
              className={`${FIELD} w-20`}
              value={setup.customH}
              onChange={(e) => setPageSetup({ customH: Number(e.target.value) || 0 })}
            />
          </Row>
        )}

        <Row label="Margin (mm)">
          <input
            type="number"
            className={`${FIELD} w-20`}
            value={setup.margin}
            onChange={(e) => setPageSetup({ margin: Number(e.target.value) || 0 })}
          />
        </Row>

        <Row label="Orientation">
          <select
            className={FIELD}
            value={setup.orientation}
            onChange={(e) =>
              setPageSetup({ orientation: e.target.value as 'portrait' | 'landscape' })
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </Row>

        <Row label="Page break before each H1">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={setup.breakBeforeH1}
            onChange={(e) => setPageSetup({ breakBeforeH1: e.target.checked })}
          />
        </Row>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setOpen(false)}
            autoFocus
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-paper hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
