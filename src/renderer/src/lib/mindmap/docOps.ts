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

/** Point a node's doc ref at an anchor (`#id`); empty/undefined clears it. */
export function setDocAnchor(doc: Y.Doc, nodeId: string, index: number, anchor?: string): void {
  const m = nodesOf(doc).get(nodeId)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    const docs = (d.docs ?? []).map((r, i) => (i === index ? { ...r, anchor: anchor || undefined } : r))
    writeData(m, { ...d, docs })
  }, LOCAL_ORIGIN)
}

/** Replace the doc ref at `index` (e.g. an external ref → its internalized form). */
export function replaceDocRef(doc: Y.Doc, nodeId: string, index: number, ref: DocRef): void {
  const m = nodesOf(doc).get(nodeId)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    writeData(m, { ...d, docs: (d.docs ?? []).map((r, i) => (i === index ? ref : r)) })
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
