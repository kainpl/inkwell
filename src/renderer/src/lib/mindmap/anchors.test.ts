import { describe, it, expect } from 'vitest'
import { resolveAnchor } from './anchors'

const doc = '# Intro\n\n## Estimate {#estimate}\n\ntext\n\nA line ^blk1\n'

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
