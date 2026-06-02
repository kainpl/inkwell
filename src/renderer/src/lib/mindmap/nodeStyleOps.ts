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
