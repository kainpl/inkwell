import { describe, it, expect } from 'vitest'
import { resolveAnchor, listAnchors } from './anchors'

const doc = '# Intro\n\n## Estimate {#estimate}\n\ntext\n\nA line ^blk1\n'

describe('listAnchors', () => {
  it('lists heading and block anchors with line + kind', () => {
    expect(listAnchors('## H {#sec}\n\ntext ^b1\n')).toEqual([
      { id: 'sec', line: 0, kind: 'heading' },
      { id: 'b1', line: 2, kind: 'block' }
    ])
  })
  it('ignores {#id} on non-heading lines', () => {
    expect(listAnchors('a {#x} b\n')).toEqual([])
  })
})

describe('resolveAnchor', () => {
  it('resolves a {#id} heading anchor', () => {
    expect(resolveAnchor(doc, '#estimate')?.line).toBe(2)
  })
  it('resolves a ^id block anchor', () => {
    expect(resolveAnchor(doc, '#blk1')?.line).toBe(6)
  })
  it('returns null when missing', () => {
    expect(resolveAnchor(doc, '#nope')).toBeNull()
  })
  it('returns null for an empty fragment', () => {
    expect(resolveAnchor(doc, '#')).toBeNull()
  })
})
