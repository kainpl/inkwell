import * as Y from 'yjs'
import type { NodeData } from '@shared/mindmap/types'
import { LOCAL_ORIGIN, nodesOf } from './yjsModel'

const readData = (m: Y.Map<unknown>): NodeData =>
  JSON.parse((m.get('dataJson') as string) || '{}') as NodeData
const writeData = (m: Y.Map<unknown>, d: NodeData): void => {
  m.set('dataJson', JSON.stringify(d))
}

/** Merge a partial style/data patch into a node (undefined values clear a key). */
export function setNodeData(doc: Y.Doc, id: string, patch: Partial<NodeData>): void {
  const m = nodesOf(doc).get(id)
  if (!m) return
  doc.transact(() => writeData(m, { ...readData(m), ...patch }), LOCAL_ORIGIN)
}

export function addTag(doc: Y.Doc, id: string, tag: string): void {
  const m = nodesOf(doc).get(id)
  if (!m || !tag) return
  doc.transact(() => {
    const d = readData(m)
    const tags = Array.isArray(d.tag) ? d.tag : []
    if (!tags.includes(tag)) writeData(m, { ...d, tag: [...tags, tag] })
  }, LOCAL_ORIGIN)
}

export function removeTag(doc: Y.Doc, id: string, tag: string): void {
  const m = nodesOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    writeData(m, { ...d, tag: (d.tag ?? []).filter((t) => t !== tag) })
  }, LOCAL_ORIGIN)
}

/** Task state machine: none → open → done → cancelled → none. */
const NEXT_TASK: Record<string, string> = {
  none: 'open',
  open: 'done',
  done: 'cancelled',
  cancelled: 'none'
}

/** Cycle a node's task status by one click (clears `task`/`taskStatus` at 'none'). */
export function cycleTask(doc: Y.Doc, id: string): void {
  const m = nodesOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    const cur = d.task ? d.taskStatus ?? 'open' : 'none'
    const next = NEXT_TASK[cur] ?? 'open'
    if (next === 'none') {
      const rest: NodeData = { ...d }
      delete rest.task
      delete rest.taskStatus
      writeData(m, rest)
    } else {
      writeData(m, { ...d, task: true, taskStatus: next as 'open' | 'done' | 'cancelled' })
    }
  }, LOCAL_ORIGIN)
}

/** Toggle a whole-label format flag (bold/italic/underline); clears the key when off. */
export function toggleLabelFlag(
  doc: Y.Doc,
  id: string,
  flag: 'bold' | 'italic' | 'underline'
): void {
  const m = nodesOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    if (d[flag]) {
      const rest: NodeData = { ...d }
      delete rest[flag]
      writeData(m, rest)
    } else {
      writeData(m, { ...d, [flag]: true })
    }
  }, LOCAL_ORIGIN)
}

/** Append a cross-`.inkproj` link (target file + display title) to a node. Only
 *  `.inkproj` paths are stored — a crafted document can't seed an arbitrary file path. */
export function addExternalLink(doc: Y.Doc, id: string, file: string, title: string): void {
  const m = nodesOf(doc).get(id)
  if (!m || !file || !/\.inkproj$/i.test(file)) return
  doc.transact(() => {
    const d = readData(m)
    const links = Array.isArray(d.extLinks) ? d.extLinks : []
    writeData(m, { ...d, extLinks: [...links, { file, title }] })
  }, LOCAL_ORIGIN)
}

/** Remove the cross-`.inkproj` link at `index`. */
export function removeExternalLink(doc: Y.Doc, id: string, index: number): void {
  const m = nodesOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    writeData(m, { ...d, extLinks: (d.extLinks ?? []).filter((_, i) => i !== index) })
  }, LOCAL_ORIGIN)
}

export function addIcon(doc: Y.Doc, id: string, icon: string): void {
  const m = nodesOf(doc).get(id)
  if (!m || !icon) return
  doc.transact(() => {
    const d = readData(m)
    const icons = Array.isArray(d.icon) ? d.icon : []
    writeData(m, { ...d, icon: [...icons, icon] })
  }, LOCAL_ORIGIN)
}

export function removeIcon(doc: Y.Doc, id: string, index: number): void {
  const m = nodesOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    writeData(m, { ...d, icon: (d.icon ?? []).filter((_, i) => i !== index) })
  }, LOCAL_ORIGIN)
}
