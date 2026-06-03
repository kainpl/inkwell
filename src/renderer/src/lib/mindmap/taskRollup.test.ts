import { describe, it, expect } from 'vitest'
import { taskRollups } from './taskRollup'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

// R → A(open) → A1(done); B(done); C(cancelled)
const md =
  '# R <!-- mindmap {"id":"r"} -->\n\n' +
  '- A <!-- mindmap {"id":"a","task":true,"taskStatus":"open"} -->\n' +
  '  - A1 <!-- mindmap {"id":"a1","task":true,"taskStatus":"done"} -->\n' +
  '- B <!-- mindmap {"id":"b","task":true,"taskStatus":"done"} -->\n' +
  '- C <!-- mindmap {"id":"c","task":true,"taskStatus":"cancelled"} -->\n'

describe('taskRollups', () => {
  it('rolls descendant task progress up to ancestors (cancelled excluded)', () => {
    const r = taskRollups(buildGraph(markdownToOutline(md).outline))
    // root sees A(open), A1(done), B(done) → 2/3; C(cancelled) excluded
    expect(r.get('r')).toEqual({ done: 2, total: 3 })
    // A sees only A1(done) → 1/1
    expect(r.get('a')).toEqual({ done: 1, total: 1 })
    // leaves have no task descendants → 0/0
    expect(r.get('a1')).toEqual({ done: 0, total: 0 })
    expect(r.get('b')).toEqual({ done: 0, total: 0 })
  })
})
