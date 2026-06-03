import { useState } from 'react'
import { Panel } from '@xyflow/react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { quickAddChild } from '@renderer/lib/mindmap/projectEditActions'
import type { GraphModel } from '@shared/mindmap/types'

/** Keyboard-first rapid capture: each Enter adds a named child under the selected
 *  node (or the root) and keeps focus for the next; Esc closes. */
export default function QuickEntry({ graph }: { graph: GraphModel | null }): JSX.Element | null {
  const activeId = useAppStore((s) => s.activeId)
  const open = useProjectStore((s) => s.byTab[activeId]?.quickOpen ?? false)
  const sel = useProjectStore((s) => s.byTab[activeId]?.selectedId ?? null)
  const setQuickOpen = useProjectStore((s) => s.setQuickOpen)
  const [text, setText] = useState('')

  if (!open) return null
  const parent = sel ?? graph?.nodes.find((n) => n.parentId === null)?.id ?? null
  const parentLabel = parent ? graph?.nodes.find((n) => n.id === parent)?.label : null

  const close = (): void => {
    setQuickOpen(false)
    setText('')
  }
  const add = (): void => {
    if (parent && text.trim()) {
      quickAddChild(parent, text.trim())
      setText('')
    }
  }

  return (
    <Panel position="top-center" className="!mt-12">
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-2 py-1 shadow-lg">
        <span className="shrink-0 text-[11px] text-faint">
          + child of <span className="font-medium text-ink">{parentLabel ?? '…'}</span>
        </span>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            } else if (e.key === 'Escape') {
              close()
            }
          }}
          placeholder="type + Enter to add, Esc to close"
          className="w-60 bg-transparent text-[13px] text-ink outline-none"
        />
        <button onClick={close} className="shrink-0 text-faint hover:text-ink" title="Close (Esc)">
          ✕
        </button>
      </div>
    </Panel>
  )
}
