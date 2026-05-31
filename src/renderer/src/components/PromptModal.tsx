import { useEffect, useRef } from 'react'
import { usePrompt } from '@renderer/store/usePrompt'

/** Renders the imperative text prompt from `usePrompt`. Enter submits, Esc cancels. */
export default function PromptModal(): JSX.Element | null {
  const open = usePrompt((s) => s.open)
  const title = usePrompt((s) => s.title)
  const value = usePrompt((s) => s.value)
  const setValue = usePrompt((s) => s.setValue)
  const submit = usePrompt((s) => s.submit)
  const cancel = usePrompt((s) => s.cancel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.select()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[20vh]"
      onMouseDown={cancel}
    >
      <div
        className="w-[24rem] max-w-[90vw] rounded-lg border border-line bg-paper p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <label className="mb-2 block text-sm text-ink">{title}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            else if (e.key === 'Escape') cancel()
          }}
          className="w-full rounded border border-line bg-chrome px-2 py-1 text-sm text-ink outline-none focus:border-accent"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={cancel} className="rounded px-3 py-1.5 text-sm text-ink hover:bg-ink/5">
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-paper hover:opacity-90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
