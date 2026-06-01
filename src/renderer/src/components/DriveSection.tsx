import { useEffect, useState } from 'react'
import { gdriveRef, type DriveNode } from '@shared/drive'
import { useAppStore } from '@renderer/store/useAppStore'
import { usePrompt } from '@renderer/store/usePrompt'
import { listChildren, openDriveFile, createDriveFile, triggerConnect } from '@renderer/lib/drive'

/** Window event to refresh a Drive folder's listing (detail = folderId). */
const REFRESH = 'ink:drive-refresh'

/** Prompt for a name and create a new markdown file in `parentId`, then refresh it. */
async function newFileIn(accountId: string, parentId: string): Promise<void> {
  const name = await usePrompt.getState().ask('New file name', 'untitled.md')
  if (!name) return
  await createDriveFile(accountId, parentId, name.endsWith('.md') ? name : `${name}.md`)
  window.dispatchEvent(new CustomEvent(REFRESH, { detail: parentId }))
}

/**
 * The "Cloud" section of the Files sidebar: each connected Google account is a
 * browsable root. Folders lazy-load their children on expand; clicking a file
 * opens it in a tab (as a `gdrive://` doc).
 */
export default function DriveSection(): JSX.Element {
  const accounts = useAppStore((s) => s.driveAccounts)

  return (
    <div className="mt-2 border-t border-line pt-1">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Cloud</span>
        <button
          onClick={triggerConnect}
          title="Connect a Google account"
          className="text-[11px] text-accent hover:underline"
        >
          ＋ Connect
        </button>
      </div>
      {accounts.length === 0 ? (
        <div className="px-3 pb-2 text-[12px] text-faint">No Google Drive connected.</div>
      ) : (
        accounts.map((a) => <DriveRoot key={a.accountId} accountId={a.accountId} email={a.email} />)
      )}
    </div>
  )
}

function DriveRoot({ accountId, email }: { accountId: string; email: string }): JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div className="group flex items-center px-2 py-1 hover:bg-ink/5">
        <button
          onClick={() => setOpen((o) => !o)}
          title={email}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12px] font-medium text-ink/70"
        >
          <span className="w-3 shrink-0 text-faint">{open ? '▾' : '▸'}</span>
          <span className="shrink-0">☁️</span>
          <span className="min-w-0 flex-1 truncate">{email}</span>
        </button>
        <button
          onClick={() => void newFileIn(accountId, 'root')}
          title="New file in this account’s root"
          className="shrink-0 px-1 text-faint opacity-0 hover:text-ink group-hover:opacity-100"
        >
          ＋
        </button>
      </div>
      {open && <DriveChildren accountId={accountId} folderId="root" depth={1} />}
    </div>
  )
}

/** Lazy-loaded children of a Drive folder. */
function DriveChildren({
  accountId,
  folderId,
  depth
}: {
  accountId: string
  folderId: string
  depth: number
}): JSX.Element {
  const [nodes, setNodes] = useState<DriveNode[] | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const h = (e: Event): void => {
      if ((e as CustomEvent<string>).detail === folderId) setVersion((v) => v + 1)
    }
    window.addEventListener(REFRESH, h)
    return () => window.removeEventListener(REFRESH, h)
  }, [folderId])

  useEffect(() => {
    let cancelled = false
    listChildren(accountId, folderId)
      .then((n) => {
        if (cancelled) return
        setNodes(n)
        setError('')
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [accountId, folderId, version])

  if (error) {
    return (
      <div
        className="truncate px-2 py-1 text-[11px] text-[#d35454]"
        style={{ paddingLeft: depth * 12 + 8 }}
        title={error}
      >
        {error}
      </div>
    )
  }
  if (nodes === null) return <Loading depth={depth} />
  if (nodes.length === 0) {
    return (
      <div className="px-2 py-1 text-[12px] text-faint" style={{ paddingLeft: depth * 12 + 8 }}>
        (empty)
      </div>
    )
  }
  return (
    <>
      {nodes.map((n) => (
        <DriveTreeRow key={n.id} accountId={accountId} node={n} depth={depth} />
      ))}
    </>
  )
}

function DriveTreeRow({
  accountId,
  node,
  depth
}: {
  accountId: string
  node: DriveNode
  depth: number
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const activePath = useAppStore((s) => s.doc.path)
  const isDir = node.type === 'directory'
  const isActive = !isDir && activePath === gdriveRef(accountId, node.id)

  const onClick = (): void => {
    if (isDir) setOpen((o) => !o)
    else void openDriveFile(accountId, node)
  }

  return (
    <div>
      <div
        className={
          'group flex items-center rounded hover:bg-ink/5 ' +
          (isActive ? 'bg-accent/10 text-accent' : 'text-ink/80')
        }
      >
        <button
          onClick={onClick}
          title={node.name}
          style={{ paddingLeft: depth * 12 + 8 }}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-[13px]"
        >
          <span className="w-3 shrink-0 text-faint">{isDir ? (open ? '▾' : '▸') : ''}</span>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        </button>
        {isDir && (
          <button
            onClick={() => void newFileIn(accountId, node.id)}
            title="New file in this folder"
            className="shrink-0 px-1 text-faint opacity-0 hover:text-ink group-hover:opacity-100"
          >
            ＋
          </button>
        )}
      </div>
      {isDir && open && <DriveChildren accountId={accountId} folderId={node.id} depth={depth + 1} />}
    </div>
  )
}

function Loading({ depth }: { depth: number }): JSX.Element {
  return (
    <div className="px-2 py-1 text-[12px] text-faint" style={{ paddingLeft: depth * 12 + 8 }}>
      Loading…
    </div>
  )
}
