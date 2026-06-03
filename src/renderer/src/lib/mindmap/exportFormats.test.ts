// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { MarkdownNode } from '@shared/mindmap/types'
import { toPlainMarkdown, toOpml, toFreeMind } from './exportFormats'
import { importAny } from './importFormats'

const sample: MarkdownNode[] = [
  {
    name: 'Root',
    data: { id: 'r' },
    children: [
      {
        name: 'A & B',
        data: { color: '#ff0000', fillColor: '#00ff00', note: 'a note' },
        children: [{ name: 'A1' }]
      },
      { name: 'C <x>' }
    ]
  }
]

describe('toPlainMarkdown', () => {
  it('emits H1 + indented bullets and round-trips through the importer', () => {
    const md = toPlainMarkdown(sample, 'Root')
    expect(md).toContain('# Root')
    expect(md).toContain('- A & B')
    expect(md).toContain('  - A1')
    const r = importAny('x.md', md)
    expect(r.title).toBe('Root')
    expect(r.outline[0].children?.map((n) => n.name)).toEqual(['A & B', 'C <x>'])
  })

  it('carries no `<!-- mindmap -->` data comments', () => {
    expect(toPlainMarkdown(sample, 'Root')).not.toContain('mindmap')
  })
})

describe('toOpml', () => {
  it('escapes attributes and round-trips structure + notes', () => {
    const opml = toOpml('Root', sample)
    expect(opml).toContain('text="A &amp; B"')
    expect(opml).toContain('&lt;x&gt;')
    expect(opml).toContain('_note="a note"')
    const r = importAny('x.opml', opml)
    expect(r.title).toBe('Root')
    expect(r.outline[0].name).toBe('Root')
    const kids = r.outline[0].children ?? []
    expect(kids.map((n) => n.name)).toEqual(['A & B', 'C <x>'])
    expect(kids[0].data?.note).toBe('a note')
  })
})

describe('toFreeMind', () => {
  it('emits a single root with colors and round-trips', () => {
    const mm = toFreeMind('Root', sample)
    expect(mm).toContain('<map version="1.0.1">')
    expect(mm).toContain('COLOR="#ff0000"')
    expect(mm).toContain('BACKGROUND_COLOR="#00ff00"')
    const r = importAny('x.mm', mm)
    expect(r.title).toBe('Root')
    const kids = r.outline[0].children ?? []
    expect(kids.map((n) => n.name)).toEqual(['A & B', 'C <x>'])
    expect(kids[0].data?.color).toBe('#ff0000')
    expect(kids[0].data?.fillColor).toBe('#00ff00')
  })

  it('synthesises a root from the title when the outline is a forest', () => {
    const forest: MarkdownNode[] = [{ name: 'One' }, { name: 'Two' }]
    const r = importAny('x.mm', toFreeMind('My Map', forest))
    expect(r.title).toBe('My Map')
    expect(r.outline[0].children?.map((n) => n.name)).toEqual(['One', 'Two'])
  })
})
