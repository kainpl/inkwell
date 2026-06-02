import { useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, type EdgeTypes, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useProjectStore, useActiveProject } from '@renderer/store/useProjectStore'
import { computeLayout, type Pos } from '@renderer/lib/mindmap/layout'
import { buildRfModel } from '@renderer/lib/mindmap/rfModel'
import type { LinkType } from '@shared/mindmap/types'
import MindNode from './MindNode'
import { TreeEdge, CrosslinkEdge } from './edges'

const nodeTypes: NodeTypes = { mind: MindNode }
const edgeTypes: EdgeTypes = { tree: TreeEdge, crosslink: CrosslinkEdge }
const EMPTY_LINK_TYPES: Record<string, LinkType> = {}

/** React Flow canvas: renders the schema tree + typed cross-links (read-only). */
export default function Canvas(): JSX.Element {
  const project = useActiveProject()
  const openDocFor = useProjectStore((s) => s.openDocFor)
  const graph = project?.graph ?? null
  const collapsed = project?.collapsed
  const linkTypes = project?.linkTypes ?? EMPTY_LINK_TYPES
  const selectedId = project?.selectedId ?? null

  // Positions depend only on the tree shape, not on collapse/selection.
  const layout = useMemo(() => (graph ? computeLayout(graph) : new Map<string, Pos>()), [graph])
  const model = useMemo(
    () =>
      graph
        ? buildRfModel(graph, layout, collapsed ?? new Set<string>(), linkTypes, selectedId)
        : { nodes: [], edges: [] },
    [graph, layout, collapsed, linkTypes, selectedId]
  )

  return (
    <ReactFlow
      nodes={model.nodes}
      edges={model.edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_e, node) => openDocFor(node.id)}
      nodesDraggable={false}
      nodesConnectable={false}
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
