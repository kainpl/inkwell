import type { GraphModel } from '@shared/mindmap/types'

export interface Slide {
  id: string
  title: string
  bullets: string[]
}

/**
 * Slides projection of the tree (one canonical model → a deck): a slide per node that
 * has children — its label is the title, its direct children the bullets — in tree
 * order. A flat map (no node has children) falls back to a single slide of all nodes.
 */
export function buildSlides(graph: GraphModel): Slide[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const slides: Slide[] = graph.nodes
    .filter((n) => (graph.childrenOf.get(n.id)?.length ?? 0) > 0)
    .map((n) => ({
      id: n.id,
      title: n.label,
      bullets: (graph.childrenOf.get(n.id) ?? []).map((cid) => byId.get(cid)?.label ?? '')
    }))
  if (!slides.length && graph.nodes.length) {
    slides.push({ id: graph.nodes[0].id, title: 'Slides', bullets: graph.nodes.map((n) => n.label) })
  }
  return slides
}
