import * as Y from 'yjs'
import type { DocRef, NodeData } from '@shared/mindmap/types'
import { LOCAL_ORIGIN, nodesOf } from './yjsModel'

const readData = (m: Y.Map<unknown>): NodeData =>
  JSON.parse((m.get('dataJson') as string) || '{}') as NodeData
const writeData = (m: Y.Map<unknown>, d: NodeData): void => {
  m.set('dataJson', JSON.stringify(d))
}

/** A node's attached doc refs (empty if none). */
export function nodeDocs(doc: Y.Doc, nodeId: string): DocRef[] {
  const m = nodesOf(doc).get(nodeId)
  if (!m) return []
  const d = readData(m)
  return Array.isArray(d.docs) ? d.docs : []
}

/** Append a doc ref to a node. */
export function pushDocRef(doc: Y.Doc, nodeId: string, ref: DocRef): void {
  const m = nodesOf(doc).get(nodeId)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    const docs = Array.isArray(d.docs) ? d.docs : []
    writeData(m, { ...d, docs: [...docs, ref] })
  }, LOCAL_ORIGIN)
}

/** Remove the doc ref at `index` from a node (the bundled file is left in place). */
export function removeDocRef(doc: Y.Doc, nodeId: string, index: number): void {
  const m = nodesOf(doc).get(nodeId)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    writeData(m, { ...d, docs: (d.docs ?? []).filter((_, i) => i !== index) })
  }, LOCAL_ORIGIN)
}
