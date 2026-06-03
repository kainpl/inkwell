import type { Edge, Node } from '@xyflow/react'
import type { GraphModel, GraphNode, LinkType } from '@shared/mindmap/types'
import type { Pos } from './layout'
import { resolveLinkType } from './linkTypes'

export interface RfNodeData {
  label: string
  raw: GraphNode
  hasChildren: boolean
  collapsed: boolean
  selected: boolean
  [k: string]: unknown
}
export type RfNode = Node<RfNodeData, 'mind'>

export interface RfEdgeData {
  linkType?: LinkType
  /** Owning node + link id (cross edges only) — for the Edge Inspector to edit. */
  fromNodeId?: string
  linkId?: string
  /** True when this cross edge is the selected link. */
  selected?: boolean
  [k: string]: unknown
}
export type RfEdge = Edge<RfEdgeData>

/** Ids hidden because an ancestor is collapsed (the collapsed node stays visible). */
function hiddenSet(graph: GraphModel, collapsed: Set<string>): Set<string> {
  const hidden = new Set<string>()
  const hide = (id: string): void => {
    for (const child of graph.childrenOf.get(id) ?? []) {
      hidden.add(child)
      hide(child)
    }
  }
  for (const id of collapsed) hide(id)
  return hidden
}

/**
 * Pure transform: graph + layout + collapse state → React Flow nodes/edges.
 * Collapsed subtrees are dropped; edges with a hidden endpoint are dropped.
 * Engine-agnostic core (testable without mounting React Flow).
 */
export function buildRfModel(
  graph: GraphModel,
  layout: Map<string, Pos>,
  collapsed: Set<string>,
  linkTypes: Record<string, LinkType>,
  selectedId: string | null = null,
  selectedLinkId: string | null = null,
  multi: Set<string> = new Set()
): { nodes: RfNode[]; edges: RfEdge[] } {
  const hidden = hiddenSet(graph, collapsed)
  const visible = (id: string): boolean => !hidden.has(id)

  const nodes: RfNode[] = graph.nodes
    .filter((n) => visible(n.id))
    .map((n) => ({
      id: n.id,
      type: 'mind',
      position: layout.get(n.id) ?? { x: 0, y: 0 },
      data: {
        label: n.label,
        raw: n,
        hasChildren: (graph.childrenOf.get(n.id)?.length ?? 0) > 0,
        collapsed: collapsed.has(n.id),
        selected: n.id === selectedId || multi.has(n.id)
      }
    }))

  const edges: RfEdge[] = graph.edges
    .filter((e) => visible(e.source) && visible(e.target))
    .map((e) =>
      e.kind === 'tree'
        ? ({ id: e.id, source: e.source, target: e.target, type: 'tree' } satisfies RfEdge)
        : ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'crosslink',
            label: e.label,
            data: {
              linkType: resolveLinkType(linkTypes, e.type ?? 'relates-to'),
              fromNodeId: e.source,
              linkId: e.linkId,
              selected: e.linkId != null && e.linkId === selectedLinkId
            }
          } satisfies RfEdge)
    )

  return { nodes, edges }
}
