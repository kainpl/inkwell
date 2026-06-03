import * as Y from 'yjs'
import { buildGraph } from './buildGraph'
import { yjsToOutline } from './yjsModel'
import { setNodeData } from './nodeStyleOps'

/** One depth tier of a mind-map palette (node colors are `data`, not chrome tokens). */
export interface ThemeColor {
  fill: string
  text: string
  line: string
}

/** Curated node palettes; a node at depth N uses entry `N % palette.length`. */
export const MINDMAP_THEMES: Record<string, ThemeColor[]> = {
  sunset: [
    { fill: '#b0663e', text: '#ffffff', line: '#8a4a2b' },
    { fill: '#e8a06a', text: '#3b2412', line: '#b0663e' },
    { fill: '#f4d3b0', text: '#3b2412', line: '#e8a06a' }
  ],
  forest: [
    { fill: '#2f5d3a', text: '#ffffff', line: '#21422a' },
    { fill: '#5c9966', text: '#10240f', line: '#2f5d3a' },
    { fill: '#bfe0c0', text: '#10240f', line: '#5c9966' }
  ],
  ocean: [
    { fill: '#1f4e6b', text: '#ffffff', line: '#143546' },
    { fill: '#4a90b8', text: '#06212e', line: '#1f4e6b' },
    { fill: '#bcdcec', text: '#06212e', line: '#4a90b8' }
  ],
  mono: [
    { fill: '#2b2b2e', text: '#ffffff', line: '#1a1a1c' },
    { fill: '#6b6b70', text: '#ffffff', line: '#2b2b2e' },
    { fill: '#d6d6d9', text: '#1a1a1c', line: '#6b6b70' }
  ]
}

/** The selectable theme keys for a picker (`clear` + the palettes). */
export const THEME_KEYS = ['clear', ...Object.keys(MINDMAP_THEMES)]

/**
 * Recolor every node by depth from a curated palette — or, for `clear`, strip the
 * theme colors (`undefined` is dropped on JSON-serialize, so the key is removed).
 * Synchronous loop ⇒ the per-node edits group into one undo step (captureTimeout).
 */
export function applyTheme(doc: Y.Doc, key: string, custom?: ThemeColor[]): void {
  const graph = buildGraph(yjsToOutline(doc))
  if (key === 'clear') {
    for (const n of graph.nodes) {
      setNodeData(doc, n.id, { fillColor: undefined, color: undefined, lineColor: undefined })
    }
    return
  }
  const palette = key === 'custom' ? custom : MINDMAP_THEMES[key]
  if (!palette || !palette.length) return
  for (const n of graph.nodes) {
    const c = palette[n.depth % palette.length]
    setNodeData(doc, n.id, { fillColor: c.fill, color: c.text, lineColor: c.line })
  }
}
