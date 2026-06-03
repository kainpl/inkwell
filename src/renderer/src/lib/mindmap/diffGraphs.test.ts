import { describe, it, expect } from 'vitest'
import { diffGraphs } from './diffGraphs'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

const g = (md: string): ReturnType<typeof buildGraph> => buildGraph(markdownToOutline(md).outline)
const base =
  '# R <!-- mindmap {"id":"r"} -->\n\n' +
  '- A <!-- mindmap {"id":"a"} -->\n' +
  '  - A1 <!-- mindmap {"id":"a1"} -->\n' +
  '- B <!-- mindmap {"id":"b"} -->\n'

describe('diffGraphs', () => {
  it('identical graphs → no changes', () => {
    const d = diffGraphs(g(base), g(base))
    expect(d).toEqual({ added: [], removed: [], renamed: [], moved: [] })
  })

  it('detects an added node', () => {
    const next = base + '- C <!-- mindmap {"id":"c"} -->\n'
    expect(diffGraphs(g(base), g(next)).added.map((x) => x.id)).toEqual(['c'])
  })

  it('detects a removed node', () => {
    const next =
      '# R <!-- mindmap {"id":"r"} -->\n\n- A <!-- mindmap {"id":"a"} -->\n  - A1 <!-- mindmap {"id":"a1"} -->\n'
    expect(diffGraphs(g(base), g(next)).removed.map((x) => x.id)).toEqual(['b'])
  })

  it('detects a rename', () => {
    const next = base.replace('- A <!--', '- Alpha <!--')
    expect(diffGraphs(g(base), g(next)).renamed).toEqual([{ id: 'a', from: 'A', to: 'Alpha' }])
  })

  it('detects a move (A1 to top level)', () => {
    const next =
      '# R <!-- mindmap {"id":"r"} -->\n\n- A <!-- mindmap {"id":"a"} -->\n' +
      '- A1 <!-- mindmap {"id":"a1"} -->\n- B <!-- mindmap {"id":"b"} -->\n'
    expect(diffGraphs(g(base), g(next)).moved.map((x) => x.id)).toEqual(['a1'])
  })
})
