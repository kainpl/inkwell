import { extractWikiTargets, buildNoteGraph } from './noteGraph'

describe('extractWikiTargets', () => {
  it('pulls targets from plain and aliased links', () => {
    expect(extractWikiTargets('see [[A]] and [[B Note|b]] here')).toEqual(['A', 'B Note'])
  })
  it('returns [] when there are none', () => {
    expect(extractWikiTargets('no links here')).toEqual([])
  })
})

describe('buildNoteGraph', () => {
  const notes = [
    { name: 'Hub.md', content: 'links to [[Target]] and [[Missing]]' },
    { name: 'Target.md', content: 'back to [[Hub]]' },
    { name: 'Lonely.md', content: 'nothing' }
  ]

  it('makes a node per note', () => {
    expect(buildNoteGraph(notes).nodes.map((n) => n.id).sort()).toEqual(['Hub', 'Lonely', 'Target'])
  })

  it('makes edges only for links to existing notes', () => {
    const edges = buildNoteGraph(notes).edges
    expect(edges).toContainEqual({ from: 'Hub', to: 'Target' })
    expect(edges).toContainEqual({ from: 'Target', to: 'Hub' })
    expect(edges.some((e) => e.to === 'Missing')).toBe(false) // unresolved
  })

  it('dedupes and ignores self-links', () => {
    const g = buildNoteGraph([{ name: 'A.md', content: '[[A]] [[A]] [[B]] [[B]]' }, { name: 'B.md', content: '' }])
    expect(g.edges).toEqual([{ from: 'A', to: 'B' }])
  })
})
