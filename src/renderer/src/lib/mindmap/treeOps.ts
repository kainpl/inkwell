import * as Y from 'yjs'
import type { MarkdownNode, NodeData } from '@shared/mindmap/types'
import { LOCAL_ORIGIN, genId, nodesOf } from './yjsModel'

type Nodes = Y.Map<Y.Map<unknown>>

const parentOf = (m: Y.Map<unknown> | undefined): string | null =>
  (m?.get('parentId') as string | null) ?? null

function childIds(nodes: Nodes, parentId: string | null): string[] {
  const rows: { id: string; order: number }[] = []
  nodes.forEach((m, id) => {
    if (parentOf(m) === parentId) rows.push({ id, order: m.get('order') as number })
  })
  return rows.sort((a, b) => a.order - b.order).map((r) => r.id)
}

function nextOrder(nodes: Nodes, parentId: string | null): number {
  let mx = -1
  nodes.forEach((m) => {
    if (parentOf(m) === parentId) mx = Math.max(mx, m.get('order') as number)
  })
  return mx + 1
}

function descendants(nodes: Nodes, root: string): Set<string> {
  const out = new Set<string>()
  const visit = (id: string): void => {
    for (const c of childIds(nodes, id)) {
      out.add(c)
      visit(c)
    }
  }
  visit(root)
  return out
}

function makeNode(parentId: string | null, order: number, id: string): Y.Map<unknown> {
  const m = new Y.Map<unknown>()
  m.set('name', '')
  m.set('parentId', parentId)
  m.set('order', order)
  m.set('dataJson', JSON.stringify({ id }))
  return m
}

/** Add an empty child under `parentId`; returns the new node id. */
export function addChild(doc: Y.Doc, parentId: string): string {
  const nodes = nodesOf(doc)
  const id = genId()
  doc.transact(() => nodes.set(id, makeNode(parentId, nextOrder(nodes, parentId), id)), LOCAL_ORIGIN)
  return id
}

/** Recursively create Yjs nodes for an imported `MarkdownNode[]` under `parentId`
 *  (appended after existing children, one undo step). Fresh ids are minted — imported
 *  ids would risk colliding with the open project's — so any imported cross-links go
 *  dangling (harmless; `buildGraph` drops edges to missing nodes). Returns the new top ids. */
export function insertOutlineUnder(
  doc: Y.Doc,
  parentId: string | null,
  items: MarkdownNode[]
): string[] {
  const nodes = nodesOf(doc)
  const topIds: string[] = []
  const addOne = (item: MarkdownNode, pId: string | null, order: number): string => {
    const id = genId()
    const m = new Y.Map<unknown>()
    m.set('name', (item.name ?? '').toString())
    m.set('parentId', pId)
    m.set('order', order)
    m.set('dataJson', JSON.stringify({ ...(item.data ?? {}), id }))
    nodes.set(id, m)
    let childOrder = 0
    for (const child of item.children ?? []) addOne(child, id, childOrder++)
    return id
  }
  doc.transact(() => {
    let order = nextOrder(nodes, parentId)
    for (const item of items) topIds.push(addOne(item, parentId, order++))
  }, LOCAL_ORIGIN)
  return topIds
}

/** Add an empty sibling after `nodeId`; returns the new node id. */
export function addSibling(doc: Y.Doc, nodeId: string): string {
  const nodes = nodesOf(doc)
  const parentId = parentOf(nodes.get(nodeId))
  const id = genId()
  doc.transact(() => nodes.set(id, makeNode(parentId, nextOrder(nodes, parentId), id)), LOCAL_ORIGIN)
  return id
}

export function rename(doc: Y.Doc, nodeId: string, name: string): void {
  const m = nodesOf(doc).get(nodeId)
  if (m) doc.transact(() => m.set('name', name), LOCAL_ORIGIN)
}

/** Delete a node + all descendants, and strip cross-links pointing at any of them. */
export function remove(doc: Y.Doc, nodeId: string): void {
  const nodes = nodesOf(doc)
  const doomed = new Set([nodeId, ...descendants(nodes, nodeId)])
  doc.transact(() => {
    for (const id of doomed) nodes.delete(id)
    nodes.forEach((m) => {
      const data = JSON.parse((m.get('dataJson') as string) || '{}') as NodeData
      if (!Array.isArray(data.links)) return
      const kept = data.links.filter((l) => !doomed.has(l.to))
      if (kept.length !== data.links.length) m.set('dataJson', JSON.stringify({ ...data, links: kept }))
    })
  }, LOCAL_ORIGIN)
}

/**
 * Place `nodeId` under `newParentId` at sibling position `index`, renumbering the
 * siblings' `order` to `0..n`. Rejects a cycle (target is the node or a descendant).
 */
export function reorder(
  doc: Y.Doc,
  nodeId: string,
  newParentId: string | null,
  index: number
): boolean {
  const nodes = nodesOf(doc)
  if (nodeId === newParentId) return false
  if (newParentId !== null && descendants(nodes, nodeId).has(newParentId)) return false
  const m = nodes.get(nodeId)
  if (!m) return false
  doc.transact(() => {
    m.set('parentId', newParentId)
    const sibs = childIds(nodes, newParentId).filter((id) => id !== nodeId)
    const at = Math.max(0, Math.min(index, sibs.length))
    sibs.splice(at, 0, nodeId)
    sibs.forEach((id, i) => nodes.get(id)?.set('order', i))
  }, LOCAL_ORIGIN)
  return true
}

/** Move `nodeId` under `newParentId`. Rejects self/descendant targets (cycle). */
export function reparent(doc: Y.Doc, nodeId: string, newParentId: string): boolean {
  const nodes = nodesOf(doc)
  if (nodeId === newParentId || descendants(nodes, nodeId).has(newParentId)) return false
  const m = nodes.get(nodeId)
  if (!m) return false
  doc.transact(() => {
    m.set('parentId', newParentId)
    m.set('order', nextOrder(nodes, newParentId))
  }, LOCAL_ORIGIN)
  return true
}
