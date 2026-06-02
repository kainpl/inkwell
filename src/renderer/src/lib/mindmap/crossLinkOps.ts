import * as Y from 'yjs'
import type { CrossLink, NodeData } from '@shared/mindmap/types'
import { LOCAL_ORIGIN, genId, nodesOf } from './yjsModel'

const readData = (m: Y.Map<unknown>): NodeData =>
  JSON.parse((m.get('dataJson') as string) || '{}') as NodeData
const writeData = (m: Y.Map<unknown>, d: NodeData): void => {
  m.set('dataJson', JSON.stringify(d))
}

/** Add a typed cross-link from `fromId` → `toId`; returns its id (null on self-link/missing). */
export function addCrossLink(
  doc: Y.Doc,
  fromId: string,
  toId: string,
  type = 'relates-to',
  label?: string
): string | null {
  if (fromId === toId) return null
  const m = nodesOf(doc).get(fromId)
  if (!m) return null
  const id = genId()
  doc.transact(() => {
    const d = readData(m)
    const links: CrossLink[] = Array.isArray(d.links) ? d.links : []
    writeData(m, { ...d, links: [...links, { id, to: toId, type, label }] })
  }, LOCAL_ORIGIN)
  return id
}

/** Patch a cross-link's type and/or label. */
export function updateCrossLink(
  doc: Y.Doc,
  fromId: string,
  linkId: string,
  patch: Partial<Pick<CrossLink, 'type' | 'label'>>
): void {
  const m = nodesOf(doc).get(fromId)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    const links = (d.links ?? []).map((l) => (l.id === linkId ? { ...l, ...patch } : l))
    writeData(m, { ...d, links })
  }, LOCAL_ORIGIN)
}

/** Delete a cross-link from its source node. */
export function removeCrossLink(doc: Y.Doc, fromId: string, linkId: string): void {
  const m = nodesOf(doc).get(fromId)
  if (!m) return
  doc.transact(() => {
    const d = readData(m)
    writeData(m, { ...d, links: (d.links ?? []).filter((l) => l.id !== linkId) })
  }, LOCAL_ORIGIN)
}
