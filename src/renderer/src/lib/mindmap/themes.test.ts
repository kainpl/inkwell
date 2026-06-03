import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { outlineToYjs, yjsToOutline } from './yjsModel'
import { applyTheme, MINDMAP_THEMES } from './themes'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import type { MarkdownNode, NodeData } from '@shared/mindmap/types'

function seed(): Y.Doc {
  const doc = new Y.Doc()
  // R(0) → A(1) → A1(2)
  const { outline, title } = markdownToOutline(
    '# R <!-- mindmap {"id":"r"} -->\n\n- A <!-- mindmap {"id":"a"} -->\n  - A1 <!-- mindmap {"id":"a1"} -->\n'
  )
  outlineToYjs(doc, outline, title)
  return doc
}
const dataOf = (doc: Y.Doc, id: string): NodeData => {
  const find = (ns: MarkdownNode[] = []): MarkdownNode | undefined => {
    for (const n of ns) {
      if (n.data?.id === id) return n
      const f = find(n.children)
      if (f) return f
    }
    return undefined
  }
  return find(yjsToOutline(doc))?.data ?? {}
}

describe('applyTheme', () => {
  it('colors nodes by depth from the palette', () => {
    const doc = seed()
    applyTheme(doc, 'ocean')
    const p = MINDMAP_THEMES.ocean
    expect(dataOf(doc, 'r').fillColor).toBe(p[0].fill) // depth 0
    expect(dataOf(doc, 'a').fillColor).toBe(p[1].fill) // depth 1
    expect(dataOf(doc, 'a1').fillColor).toBe(p[2].fill) // depth 2
    expect(dataOf(doc, 'a').color).toBe(p[1].text)
    expect(dataOf(doc, 'a').lineColor).toBe(p[1].line)
  })

  it('clear strips theme colors but keeps other keys', () => {
    const doc = seed()
    applyTheme(doc, 'forest')
    applyTheme(doc, 'clear')
    expect(dataOf(doc, 'a').fillColor).toBeUndefined()
    expect(dataOf(doc, 'a').color).toBeUndefined()
    expect(dataOf(doc, 'a').lineColor).toBeUndefined()
    expect(dataOf(doc, 'a').id).toBe('a') // id preserved
  })
})
