import { useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, type EdgeTypes, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useProjectStore } from '@renderer/store/useProjectStore'
import { computeLayout, type Pos } from '@renderer/lib/mindmap/layout'
import { buildRfModel } from '@renderer/lib/mindmap/rfModel'
import MindNode from './MindNode'
import { TreeEdge, CrosslinkEdge } from './edges'

const nodeTypes: NodeTypes = { mind: MindNode }
const edgeTypes: EdgeTypes = { tree: TreeEdge, crosslink: CrosslinkEdge }

/** React Flow canvas: renders the schema tree + typed cross-links (read-only). */
export default function Canvas(): JSX.Element {
  const graph = useProjectStore((s) => s.graph)
  const linkTypes = useProjectStore((s) => s.linkTypes)
  const collapsed = useProjectStore((s) => s.collapsed)
  const selectedId = useProjectStore((s) => s.selectedId)
  const openDocFor = useProjectStore((s) => s.openDocFor)

  // Positions depend only on the tree shape, not on collapse/selection.
  const layout = useMemo(() => (graph ? computeLayout(graph) : new Map<string, Pos>()), [graph])
  const model = useMemo(
    () =>
      graph
        ? buildRfModel(graph, layout, collapsed, linkTypes, selectedId)
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
