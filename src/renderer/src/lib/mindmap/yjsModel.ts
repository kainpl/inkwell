import * as Y from 'yjs'
import type { MarkdownNode, NodeData } from '@shared/mindmap/types'

/** Transaction origin for local edits — tracked by the per-project UndoManager. */
export const LOCAL_ORIGIN = Symbol('inkproj-local')

let counter = 0
/** Session-unique node id (not stored deterministically; never asserted on). */
export const genId = (): string => `n-${Date.now().toString(36)}-${(counter++).toString(36)}`

type Nodes = Y.Map<Y.Map<unknown>>
export const nodesOf = (doc: Y.Doc): Nodes => doc.getMap('nodes') as Nodes

function writeNode(
  nodes: Nodes,
  id: string,
  name: string,
  parentId: string | null,
  order: number,
  data: NodeData
): void {
  const m = new Y.Map<unknown>()
  m.set('name', name)
  m.set('parentId', parentId)
  m.set('order', order)
  m.set('dataJson', JSON.stringify({ ...data, id }))
  nodes.set(id, m)
}

/** Write an outline's nodes into the (flat) nodes map — shared by seed + replace. */
function seedOutline(nodes: Nodes, outline: MarkdownNode[]): void {
  const walk = (node: MarkdownNode, parentId: string | null, order: number): void => {
    const data = (node.data ?? {}) as NodeData
    const id = typeof data.id === 'string' && data.id ? data.id : genId()
    writeNode(nodes, id, node.name ?? '', parentId, order, { ...data, id })
    ;(node.children ?? []).forEach((child, i) => walk(child, id, i))
  }
  outline.forEach((root, i) => walk(root, null, i))
}

/** Seed a fresh doc from a parsed outline. Tree is stored flat as
 *  `parentId` + `order` per node (cheap reparent/reorder under a CRDT). */
export function outlineToYjs(doc: Y.Doc, outline: MarkdownNode[], title = ''): void {
  const nodes = nodesOf(doc)
  doc.transact(() => {
    doc.getMap('meta').set('title', title)
    seedOutline(nodes, outline)
  })
}

/** Replace the whole doc (clear + re-seed) from an outline, in ONE `LOCAL_ORIGIN`
 *  transaction so it's a single undo step. Used by edit-history in-place rollback. */
export function replaceOutline(doc: Y.Doc, outline: MarkdownNode[], title = ''): void {
  const nodes = nodesOf(doc)
  doc.transact(() => {
    for (const id of [...nodes.keys()]) nodes.delete(id)
    doc.getMap('meta').set('title', title)
    seedOutline(nodes, outline)
  }, LOCAL_ORIGIN)
}

/** Rebuild the outline tree from the doc (children sorted by `order`). */
export function yjsToOutline(doc: Y.Doc): MarkdownNode[] {
  const nodes = nodesOf(doc)
  interface Row {
    id: string
    name: string
    parentId: string | null
    order: number
    data: NodeData
  }
  const byParent = new Map<string | null, Row[]>()
  nodes.forEach((m, id) => {
    const row: Row = {
      id,
      name: (m.get('name') as string) ?? '',
      parentId: (m.get('parentId') as string | null) ?? null,
      order: (m.get('order') as number) ?? 0,
      data: JSON.parse((m.get('dataJson') as string) || '{}') as NodeData
    }
    const arr = byParent.get(row.parentId) ?? []
    arr.push(row)
    byParent.set(row.parentId, arr)
  })
  for (const arr of byParent.values()) arr.sort((a, b) => a.order - b.order)
  const build = (row: Row): MarkdownNode => ({
    name: row.name,
    data: row.data,
    children: (byParent.get(row.id) ?? []).map(build)
  })
  return (byParent.get(null) ?? []).map(build)
}
