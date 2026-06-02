import { useEffect, useState, type ReactNode } from 'react'
import { IPC, type GitChange, type GitChanges, type GitResult } from '@shared/ipc'
import {
  fetchGitChanges,
  stagePaths,
  unstagePaths,
  commitStaged,
  pushBranch,
  pullBranch
} from '@renderer/lib/gitActions'
import { useT, t as translateNow } from '@renderer/lib/i18n'

const EMPTY: GitChanges = { branch: null, ahead: 0, behind: 0, staged: [], unstaged: [] }

/** Status-char colours, matching the file-tree badges. */
const CHAR_COLOR: Record<string, string> = {
  M: '#d9912a',
  A: '#3a9e4a',
  '?': '#3a9e4a',
  D: '#d35454',
  U: '#d35454',
  R: '#4a86d9',
  C: '#4a86d9'
}

/** Source Control panel (View ▸ Source Control…): stage / unstage / commit. */
export default function SourceControl(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [changes, setChanges] = useState<GitChanges>(EMPTY)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  useEffect(
    () =>
      window.api.onMenu(IPC.menuSourceControl, () => {
        setError(null)
        void fetchGitChanges().then((c) => {
          setChanges(c)
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

  if (!open) return null

  const reload = async (): Promise<void> => setChanges(await fetchGitChanges())

  const run = async (fn: () => Promise<GitResult>, onOk?: () => void): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await fn()
    if (!res.ok) setError(res.error || translateNow('git.failed'))
    else onOk?.()
    await reload()
    setBusy(false)
  }

  const isRepo = changes.branch !== null
  const paths = (cs: GitChange[]): string[] => cs.map((c) => c.path)
  const canCommit = !busy && message.trim().length > 0 && changes.staged.length > 0

  const Row = ({ c, char, action, sign }: { c: GitChange; char: string; action: () => void; sign: string }): JSX.Element => (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-line/40">
      <span className="w-4 text-center font-mono font-bold" style={{ color: CHAR_COLOR[char] || 'rgb(var(--faint))' }}>
        {char}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink" title={c.path}>
        {c.path}
      </span>
      <button
        onClick={action}
        disabled={busy}
        className="rounded px-1.5 font-mono text-faint opacity-0 hover:text-ink group-hover:opacity-100 disabled:opacity-0"
        title={sign === '+' ? t('git.stage') : t('git.unstage')}
      >
        {sign}
      </button>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-8"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="text-sm font-semibold text-ink">
            {t('git.title')}{' '}
            {isRepo && (
              <span className="font-normal text-faint">
                ⎇ {changes.branch}
                {changes.ahead > 0 && ` ↑${changes.ahead}`}
                {changes.behind > 0 && ` ↓${changes.behind}`}
              </span>
            )}
          </span>
          <button onClick={() => setOpen(false)} className="text-faint hover:text-ink">
            ✕
          </button>
        </div>

        {!isRepo ? (
          <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-faint">
            {t('git.notRepo')}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-line p-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('git.commitPlaceholder')}
                rows={2}
                className="w-full resize-none rounded border border-line bg-paper px-2 py-1 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
              <button
                onClick={() => void run(() => commitStaged(message), () => setMessage(''))}
                disabled={!canCommit}
                className="mt-2 w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-40"
              >
                {t('git.commit')} {changes.staged.length > 0 ? `(${changes.staged.length})` : ''}
              </button>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void run(() => pullBranch())}
                  disabled={busy}
                  title={t('git.pullTitle')}
                  className="flex-1 rounded border border-line px-3 py-1 text-sm text-ink hover:border-accent hover:text-accent disabled:opacity-40"
                >
                  {t('git.pull')}{changes.behind > 0 ? ` ↓${changes.behind}` : ''}
                </button>
                <button
                  onClick={() => void run(() => pushBranch())}
                  disabled={busy}
                  title={t('git.pushTitle')}
                  className="flex-1 rounded border border-line px-3 py-1 text-sm text-ink hover:border-accent hover:text-accent disabled:opacity-40"
                >
                  {t('git.push')}{changes.ahead > 0 ? ` ↑${changes.ahead}` : ''}
                </button>
              </div>
              {error && <p className="mt-2 whitespace-pre-wrap text-xs text-[#d35454]">{error}</p>}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {changes.staged.length > 0 && (
                <Section
                  title={t('git.staged')}
                  count={changes.staged.length}
                  actionLabel={t('git.unstageAll')}
                  onAction={() => void run(() => unstagePaths(paths(changes.staged)))}
                  busy={busy}
                >
                  {changes.staged.map((c) => (
                    <Row
                      key={c.path}
                      c={c}
                      char={c.index === ' ' ? 'M' : c.index}
                      sign="−"
                      action={() => void run(() => unstagePaths([c.path]))}
                    />
                  ))}
                </Section>
              )}

              {changes.unstaged.length > 0 && (
                <Section
                  title={t('git.changes')}
                  count={changes.unstaged.length}
                  actionLabel={t('git.stageAll')}
                  onAction={() => void run(() => stagePaths(paths(changes.unstaged)))}
                  busy={busy}
                >
                  {changes.unstaged.map((c) => (
                    <Row
                      key={c.path}
                      c={c}
                      char={c.worktree === ' ' ? 'M' : c.worktree}
                      sign="+"
                      action={() => void run(() => stagePaths([c.path]))}
                    />
                  ))}
                </Section>
              )}

              {changes.staged.length === 0 && changes.unstaged.length === 0 && (
                <p className="py-8 text-center text-sm text-faint">{t('git.noChanges')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  count,
  actionLabel,
  onAction,
  busy,
  children
}: {
  title: string
  count: number
  actionLabel: string
  onAction: () => void
  busy: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          {title} ({count})
        </span>
        <button
          onClick={onAction}
          disabled={busy}
          className="text-xs text-accent hover:underline disabled:opacity-40"
        >
          {actionLabel}
        </button>
      </div>
      {children}
    </div>
  )
}
