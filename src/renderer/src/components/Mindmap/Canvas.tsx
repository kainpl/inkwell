import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
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
import { buildRfModel, type RfNode, type RfEdge, type RfNodeData } from '@renderer/lib/mindmap/rfModel'
import { getProjectDoc } from '@renderer/lib/mindmap/yjsRegistry'
import { reparent } from '@renderer/lib/mindmap/treeOps'
import type { LinkType } from '@shared/mindmap/types'
import MindNode from './MindNode'
import { TreeEdge, CrosslinkEdge } from './edges'

const nodeTypes: NodeTypes = { mind: MindNode }
const edgeTypes: EdgeTypes = { tree: TreeEdge, crosslink: CrosslinkEdge }
const EMPTY_LINK_TYPES: Record<string, LinkType> = {}
/** Drop within this many px of another node → reparent onto it. */
const REPARENT_RADIUS = 140

/** React Flow canvas: renders the schema tree + typed cross-links, with
 *  drag-to-reparent. Nodes are kept in local state (so a drag is visible) and
 *  re-synced from the Yjs-derived model after every edit. */
export default function Canvas(): JSX.Element {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const openDocFor = useProjectStore((s) => s.openDocFor)
  const graph = useProjectGraph(activeId)
  const collapsed = project?.collapsed
  const linkTypes = project?.linkTypes ?? EMPTY_LINK_TYPES
  const selectedId = project?.selectedId ?? null

  // Positions depend only on the tree shape, not on collapse/selection.
  const layout = useMemo(() => (graph ? computeLayout(graph) : new Map<string, Pos>()), [graph])
  const model = useMemo(
    () =>
      graph
        ? buildRfModel(graph, layout, collapsed ?? new Set<string>(), linkTypes, selectedId)
        : { nodes: [] as RfNode[], edges: [] as RfEdge[] },
    [graph, layout, collapsed, linkTypes, selectedId]
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

  const onNodeDragStop = useCallback(
    (_e: unknown, node: RfNode) => {
      // Nearest other node to the drop point (compare against stable layout positions).
      let best: { id: string; d: number } | null = null
      for (const n of model.nodes) {
        if (n.id === node.id) continue
        const d = Math.hypot(n.position.x - node.position.x, n.position.y - node.position.y)
        if (best == null || d < best.d) best = { id: n.id, d }
      }
      const pd = getProjectDoc(activeId)
      if (best && best.d <= REPARENT_RADIUS && pd && reparent(pd.doc, node.id, best.id)) {
        useAppStore.getState().setTabDirty(activeId, true)
        // model change → effect re-lays-out under the new parent
      } else {
        setNodes(model.nodes) // no target → snap back to layout
      }
    },
    [model, activeId]
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_e, node) => openDocFor(node.id, (node.data as RfNodeData).raw.data.docs?.[0])}
      nodesConnectable={false}
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
