import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAppStore } from '@renderer/store/useAppStore'
import { useProjectStore, useActiveProject } from '@renderer/store/useProjectStore'
import { useProjectGraph } from '@renderer/lib/mindmap/useProjectGraph'
import { computeLayout, type Pos } from '@renderer/lib/mindmap/layout'
import {
  buildRfModel,
  type RfNode,
  type RfEdge,
  type RfNodeData,
  type RfEdgeData
} from '@renderer/lib/mindmap/rfModel'
import { getProjectDoc } from '@renderer/lib/mindmap/yjsRegistry'
import { reparent, reorder } from '@renderer/lib/mindmap/treeOps'
import { addCrossLink } from '@renderer/lib/mindmap/crossLinkOps'
import type { LinkType } from '@shared/mindmap/types'
import MindNode from './MindNode'
import { TreeEdge, CrosslinkEdge } from './edges'

const nodeTypes: NodeTypes = { mind: MindNode }
const edgeTypes: EdgeTypes = { tree: TreeEdge, crosslink: CrosslinkEdge }
const EMPTY_LINK_TYPES: Record<string, LinkType> = {}
/** Drop within this many px of another node → act on it (reparent or reorder). */
const REPARENT_RADIUS = 140
/** Dropped this far to the right of the nearest node → become its child (else reorder as a sibling). */
const CHILD_DX = 100

/** React Flow canvas: renders the schema tree + typed cross-links, with
 *  drag-to-reparent. Nodes are kept in local state (so a drag is visible) and
 *  re-synced from the Yjs-derived model after every edit. */
export default function Canvas(): JSX.Element {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const openDocFor = useProjectStore((s) => s.openDocFor)
  const selectLink = useProjectStore((s) => s.selectLink)
  const graph = useProjectGraph(activeId)
  const collapsed = project?.collapsed
  const linkTypes = project?.linkTypes ?? EMPTY_LINK_TYPES
  const selectedId = project?.selectedId ?? null
  const selectedLinkId = project?.selectedLink?.linkId ?? null

  // Positions depend only on the tree shape, not on collapse/selection.
  const layout = useMemo(() => (graph ? computeLayout(graph) : new Map<string, Pos>()), [graph])
  const model = useMemo(
    () =>
      graph
        ? buildRfModel(graph, layout, collapsed ?? new Set<string>(), linkTypes, selectedId, selectedLinkId)
        : { nodes: [] as RfNode[], edges: [] as RfEdge[] },
    [graph, layout, collapsed, linkTypes, selectedId, selectedLinkId]
  )

  // Local copies React Flow mutates during a drag, re-synced whenever the Yjs model
  // changes. This is the documented controlled-flow pattern: the effect synchronizes
  // local state with an external system (React Flow), which is exactly what the
  // set-state-in-effect guidance carves out an exception for.
  const [nodes, setNodes] = useState<RfNode[]>(model.nodes)
  const [edges, setEdges] = useState<RfEdge[]>(model.edges)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(model.nodes)
    setEdges(model.edges)
  }, [model])

  const onNodesChange = useCallback(
    (changes: NodeChange<RfNode>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange<RfEdge>[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  const onConnect = useCallback(
    ({ source, target }: Connection) => {
      if (!source || !target) return
      const pd = getProjectDoc(activeId)
      if (!pd) return
      const linkId = addCrossLink(pd.doc, source, target)
      if (linkId) {
        useAppStore.getState().setTabDirty(activeId, true)
        selectLink(source, linkId)
      }
    },
    [activeId, selectLink]
  )

  const onNodeDragStop = useCallback(
    (_e: unknown, node: RfNode) => {
      const pd = getProjectDoc(activeId)
      // Nearest other node to the drop point (compare against stable layout positions).
      let best: { id: string; d: number; pos: { x: number; y: number } } | null = null
      for (const n of model.nodes) {
        if (n.id === node.id) continue
        const d = Math.hypot(n.position.x - node.position.x, n.position.y - node.position.y)
        if (best == null || d < best.d) best = { id: n.id, d, pos: n.position }
      }
      if (!graph || !pd || !best || best.d > REPARENT_RADIUS) {
        setNodes(model.nodes) // no target → snap back to layout
        return
      }
      let ok = false
      if (node.position.x - best.pos.x > CHILD_DX) {
        // dropped in the target's child column → become its child
        ok = reparent(pd.doc, node.id, best.id)
      } else {
        // dropped beside the target → reorder among the target's siblings (before/after by Y)
        const t = graph.nodes.find((g) => g.id === best!.id)
        if (t) {
          const sibs = (
            t.parentId === null
              ? graph.nodes.filter((n) => n.parentId === null).map((n) => n.id)
              : graph.childrenOf.get(t.parentId) ?? []
          ).filter((id) => id !== node.id)
          const ti = sibs.indexOf(best.id)
          if (ti >= 0) {
            ok = reorder(pd.doc, node.id, t.parentId, ti + (node.position.y < best.pos.y ? 0 : 1))
          }
        }
      }
      if (ok) useAppStore.getState().setTabDirty(activeId, true)
      else setNodes(model.nodes) // rejected → snap back
    },
    [model, graph, activeId]
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_e, node) => openDocFor(node.id, (node.data as RfNodeData).raw.data.docs?.[0])}
      onEdgeClick={(_e, edge) => {
        const d = edge.data as RfEdgeData | undefined
        if (edge.type === 'crosslink' && d?.fromNodeId && d?.linkId) selectLink(d.fromNodeId, d.linkId)
      }}
      nodesConnectable
      deleteKeyCode={null}
      elementsSelectable
      fitView
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  )
}
