import { useEffect, useState } from 'react'

/** Modal progress overlay shown while pandoc is downloaded on demand. */
export default function PandocDownload(): JSX.Element | null {
  const [pct, setPct] = useState(-1)
  useEffect(() => window.api.onPandocProgress(setPct), [])

  if (pct < 0 || pct >= 100) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[22rem] max-w-[90vw] rounded-lg border border-line bg-paper p-5 shadow-xl">
        <div className="mb-2 text-sm font-medium text-ink">Downloading pandoc…</div>
        <div className="h-2 w-full overflow-hidden rounded bg-ink/10">
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] text-faint">{pct}%</div>
      </div>
    </div>
  )
}
