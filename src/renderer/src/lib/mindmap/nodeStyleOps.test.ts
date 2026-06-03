import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { outlineToYjs, yjsToOutline } from './yjsModel'
import {
  setNodeData,
  addTag,
  removeTag,
  addIcon,
  removeIcon,
  cycleTask,
  toggleLabelFlag
} from './nodeStyleOps'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'
import type { MarkdownNode, NodeData } from '@shared/mindmap/types'

function seed(): Y.Doc {
  const doc = new Y.Doc()
  const { outline, title } = markdownToOutline('# R\n\n- A <!-- mindmap {"id":"a","color":"#111"} -->\n')
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

describe('node style ops', () => {
  it('setNodeData merges, preserving other keys', () => {
    const doc = seed()
    setNodeData(doc, 'a', { fillColor: '#abc', shape: 'pill' })
    expect(dataOf(doc, 'a')).toMatchObject({ id: 'a', color: '#111', fillColor: '#abc', shape: 'pill' })
  })
  it('tags add (deduped) and remove', () => {
    const doc = seed()
    addTag(doc, 'a', 'api')
    addTag(doc, 'a', 'api')
    expect(dataOf(doc, 'a').tag).toEqual(['api'])
    removeTag(doc, 'a', 'api')
    expect(dataOf(doc, 'a').tag).toEqual([])
  })
  it('cycleTask walks none → open → done → cancelled → none', () => {
    const doc = seed()
    expect(dataOf(doc, 'a').task).toBeUndefined()
    cycleTask(doc, 'a')
    expect(dataOf(doc, 'a')).toMatchObject({ task: true, taskStatus: 'open' })
    cycleTask(doc, 'a')
    expect(dataOf(doc, 'a').taskStatus).toBe('done')
    cycleTask(doc, 'a')
    expect(dataOf(doc, 'a').taskStatus).toBe('cancelled')
    cycleTask(doc, 'a')
    expect(dataOf(doc, 'a').task).toBeUndefined()
    expect(dataOf(doc, 'a').taskStatus).toBeUndefined()
    expect(dataOf(doc, 'a').color).toBe('#111') // other keys preserved
  })
  it('toggleLabelFlag flips a format flag on and off', () => {
    const doc = seed()
    expect(dataOf(doc, 'a').bold).toBeUndefined()
    toggleLabelFlag(doc, 'a', 'bold')
    expect(dataOf(doc, 'a').bold).toBe(true)
    toggleLabelFlag(doc, 'a', 'italic')
    expect(dataOf(doc, 'a')).toMatchObject({ bold: true, italic: true })
    toggleLabelFlag(doc, 'a', 'bold')
    expect(dataOf(doc, 'a').bold).toBeUndefined()
    expect(dataOf(doc, 'a').italic).toBe(true)
    expect(dataOf(doc, 'a').color).toBe('#111') // other keys preserved
  })
  it('icons add and remove by index', () => {
    const doc = seed()
    addIcon(doc, 'a', '🚀')
    addIcon(doc, 'a', '🔥')
    expect(dataOf(doc, 'a').icon).toEqual(['🚀', '🔥'])
    removeIcon(doc, 'a', 0)
    expect(dataOf(doc, 'a').icon).toEqual(['🔥'])
  })
})
