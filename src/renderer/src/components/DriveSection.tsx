import { useEffect, useState } from 'react'
import { gdriveRef, type DriveNode } from '@shared/drive'
import { useAppStore } from '@renderer/store/useAppStore'
import { listChildren, openDriveFile, triggerConnect } from '@renderer/lib/drive'

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
      <button
        onClick={() => setOpen((o) => !o)}
        title={email}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[12px] font-medium text-ink/70 hover:bg-ink/5"
      >
        <span className="w-3 shrink-0 text-faint">{open ? '▾' : '▸'}</span>
        <span className="shrink-0">☁️</span>
        <span className="min-w-0 flex-1 truncate">{email}</span>
      </button>
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

  useEffect(() => {
    let cancelled = false
    listChildren(accountId, folderId)
      .then((n) => !cancelled && setNodes(n))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [accountId, folderId])

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
      <button
        onClick={onClick}
        title={node.name}
        style={{ paddingLeft: depth * 12 + 8 }}
        className={
          'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[13px] hover:bg-ink/5 ' +
          (isActive ? 'bg-accent/10 text-accent' : 'text-ink/80')
        }
      >
        <span className="w-3 shrink-0 text-faint">{isDir ? (open ? '▾' : '▸') : ''}</span>
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
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
