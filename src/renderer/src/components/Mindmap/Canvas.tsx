import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ViewportPortal,
  useReactFlow,
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
import { resolveDrop, type DropTarget } from '@renderer/lib/mindmap/resolveDrop'
import { setCenterNodeFn } from '@renderer/lib/mindmap/canvasViewport'
import { focusSet } from '@renderer/lib/mindmap/treeNav'
import type { LinkType } from '@shared/mindmap/types'
import MindNode from './MindNode'
import { TreeEdge, CrosslinkEdge } from './edges'
import SearchPanel from './SearchPanel'

/** Registers a center-on-node fn (it has both the layout and a React Flow instance)
 *  so callers outside the flow (key handlers) can center the viewport. */
function ViewportRegistrar({ layout }: { layout: Map<string, Pos> }): null {
  const { setCenter } = useReactFlow()
  const layoutRef = useRef(layout)
  useEffect(() => {
    layoutRef.current = layout
  }, [layout])
  useEffect(() => {
    setCenterNodeFn((id) => {
      const p = layoutRef.current.get(id)
      if (p) void setCenter(p.x + 100, p.y + 16, { zoom: 1, duration: 300 })
    })
    return () => setCenterNodeFn(null)
  }, [setCenter])
  return null
}

const nodeTypes: NodeTypes = { mind: MindNode }
const edgeTypes: EdgeTypes = { tree: TreeEdge, crosslink: CrosslinkEdge }
const EMPTY_LINK_TYPES: Record<string, LinkType> = {}
const EMPTY_MULTI: Set<string> = new Set()

const posList = (nodes: RfNode[]): { id: string; x: number; y: number }[] =>
  nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }))

/** Live drag indicator (in flow coordinates, via ViewportPortal). */
function DropGhost({ hint, layout }: { hint: DropTarget; layout: Map<string, Pos> }): JSX.Element | null {
  if (!hint) return null
  const p = layout.get(hint.targetId)
  if (!p) return null
  const accent = 'rgb(var(--accent))'
  if (hint.kind === 'child') {
    const style = {
      position: 'absolute' as const,
      left: p.x - 6,
      top: p.y - 6,
      width: 170,
      height: 36,
      border: `2px dashed ${accent}`,
      borderRadius: 8,
      pointerEvents: 'none' as const
    }
    return <div style={style} />
  }
  const style = {
    position: 'absolute' as const,
    left: p.x - 8,
    top: hint.before ? p.y - 10 : p.y + 34,
    width: 180,
    height: 3,
    background: accent,
    borderRadius: 2,
    pointerEvents: 'none' as const
  }
  return <div style={style} />
}

/** React Flow canvas: renders the schema tree + typed cross-links, with
 *  drag-to-reparent. Nodes are kept in local state (so a drag is visible) and
 *  re-synced from the Yjs-derived model after every edit. */
export default function Canvas(): JSX.Element {
  const project = useActiveProject()
  const activeId = useAppStore((s) => s.activeId)
  const openDocFor = useProjectStore((s) => s.openDocFor)
  const selectLink = useProjectStore((s) => s.selectLink)
  const toggleInSelection = useProjectStore((s) => s.toggleInSelection)
  const graph = useProjectGraph(activeId)
  const collapsed = project?.collapsed
  const linkTypes = project?.linkTypes ?? EMPTY_LINK_TYPES
  const selectedId = project?.selectedId ?? null
  const selectedLinkId = project?.selectedLink?.linkId ?? null
  const multi = project?.multi ?? EMPTY_MULTI
  const highlightTag = project?.highlightTag ?? null
  const focusId = project?.focusId ?? null

  // Positions depend on the tree shape AND collapse (collapsed subtrees reserve no
  // space — otherwise visible nodes spread out as if everything were expanded).
  const layout = useMemo(
    () => (graph ? computeLayout(graph, collapsed) : new Map<string, Pos>()),
    [graph, collapsed]
  )
  const focus = useMemo(
    () => (graph && focusId ? focusSet(graph, focusId) : null),
    [graph, focusId]
  )
  const model = useMemo(
    () =>
      graph
        ? buildRfModel(graph, layout, collapsed ?? new Set<string>(), linkTypes, selectedId, selectedLinkId, multi, highlightTag, focus)
        : { nodes: [] as RfNode[], edges: [] as RfEdge[] },
    [graph, layout, collapsed, linkTypes, selectedId, selectedLinkId, multi, highlightTag, focus]
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

  const [dropHint, setDropHint] = useState<DropTarget>(null)
  const hintKey = useRef('')

  const onNodeDrag = useCallback(
    (_e: unknown, node: RfNode) => {
      if (!graph) return
      const t = resolveDrop(graph, posList(model.nodes), node.id, node.position)
      const key = t ? JSON.stringify(t) : ''
      if (key !== hintKey.current) {
        hintKey.current = key
        setDropHint(t)
      }
    },
    [model, graph]
  )

  const onNodeDragStop = useCallback(
    (_e: unknown, node: RfNode) => {
      hintKey.current = ''
      setDropHint(null)
      const pd = getProjectDoc(activeId)
      if (!graph || !pd) {
        setNodes(model.nodes)
        return
      }
      const t = resolveDrop(graph, posList(model.nodes), node.id, node.position)
      let ok = false
      if (t?.kind === 'child') ok = reparent(pd.doc, node.id, t.targetId)
      else if (t?.kind === 'sibling') ok = reorder(pd.doc, node.id, t.parentId, t.index)
      if (ok) useAppStore.getState().setTabDirty(activeId, true)
      else setNodes(model.nodes) // no target / rejected → snap back to layout
    },
    [model, graph, activeId]
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(e, node) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) toggleInSelection(node.id)
        else openDocFor(node.id, (node.data as RfNodeData).raw.data.docs?.[0])
      }}
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
      <ViewportRegistrar layout={layout} />
      <SearchPanel graph={graph} />
      {dropHint ? (
        <ViewportPortal>
          <DropGhost hint={dropHint} layout={layout} />
        </ViewportPortal>
      ) : null}
    </ReactFlow>
  )
}
