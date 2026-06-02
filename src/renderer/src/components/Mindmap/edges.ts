import { createElement } from 'react'
import { BaseEdge, getBezierPath, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import type { RfEdgeData } from '@renderer/lib/mindmap/rfModel'

/** Parent→child tree edge (neutral, auto-routed). */
export function TreeEdge(props: EdgeProps): JSX.Element {
  const [path] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition
  })
  return createElement(BaseEdge, {
    id: props.id,
    path,
    style: { stroke: 'rgb(var(--line, 203 210 221))', strokeWidth: 1.5 }
  })
}

/** Typed cross-link edge — color/dash from the link-type registry. */
export function CrosslinkEdge(props: EdgeProps): JSX.Element {
  const [path] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition
  })
  const linkType = (props.data as RfEdgeData | undefined)?.linkType
  const color = linkType?.color ?? '#7a8aa0'
  return createElement(BaseEdge, {
    id: props.id,
    path,
    markerEnd: props.markerEnd,
    style: {
      stroke: color,
      strokeWidth: 1.5,
      strokeDasharray: linkType?.directed ? undefined : '5 3'
    }
  })
}
