import { useEffect, useState } from 'react'
import { IPC } from '@shared/ipc'
import { connectAccount, DRIVE_CONNECT_EVENT } from '@renderer/lib/drive'

/**
 * Drive sign-in modal. Triggered by File ▸ Connect Google Drive… (menu) or the
 * `DRIVE_CONNECT_EVENT` (sidebar / Preferences buttons). Shows a waiting state
 * while the system browser handles consent, then closes on success or shows the
 * error.
 */
export default function DriveConnect(): JSX.Element | null {
  const [state, setState] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const start = (): void => {
      setError('')
      setState('waiting')
      void connectAccount().then((r) => {
        if (r.ok) setState('idle')
        else {
          setError(r.error || 'Sign-in failed.')
          setState('error')
        }
      })
    }
    const offMenu = window.api.onMenu(IPC.menuConnectDrive, start)
    window.addEventListener(DRIVE_CONNECT_EVENT, start)
    return () => {
      offMenu()
      window.removeEventListener(DRIVE_CONNECT_EVENT, start)
    }
  }, [])

  if (state === 'idle') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-8">
      <div className="w-full max-w-sm rounded-lg border border-line bg-paper p-5 text-center shadow-xl">
        {state === 'waiting' ? (
          <>
            <div className="mb-3 text-2xl">☁️</div>
            <p className="text-sm font-medium text-ink">Waiting for Google sign-in…</p>
            <p className="mt-1 text-[12px] text-faint">
              Complete the consent in your browser. This window closes automatically.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">Couldn’t connect</p>
            <p className="mt-2 whitespace-pre-wrap text-[12px] text-[#d35454]">{error}</p>
            <button
              onClick={() => setState('idle')}
              className="mt-4 rounded border border-line px-4 py-1 text-sm text-ink hover:border-accent hover:text-accent"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  )
}
