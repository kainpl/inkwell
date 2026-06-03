import { describe, it, expect } from 'vitest'
import { inlineMd } from './inlineMd'

describe('inlineMd', () => {
  it('splits bold / italic / code / strike segments', () => {
    expect(inlineMd('a **b** c')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }])
    expect(inlineMd('*i*')).toEqual([{ text: 'i', italic: true }])
    expect(inlineMd('`x`')).toEqual([{ text: 'x', code: true }])
    expect(inlineMd('~~s~~')).toEqual([{ text: 's', strike: true }])
  })
  it('prefers ** over * (longest marker first)', () => {
    expect(inlineMd('**b**')).toEqual([{ text: 'b', bold: true }])
  })
  it('leaves plain text and unclosed markers literal', () => {
    expect(inlineMd('plain')).toEqual([{ text: 'plain' }])
    expect(inlineMd('**unclosed')).toEqual([{ text: '**unclosed' }])
    expect(inlineMd('****')).toEqual([{ text: '****' }]) // empty inner → literal
  })
  it('handles multiple segments in order', () => {
    expect(inlineMd('**b** and *i*')).toEqual([
      { text: 'b', bold: true },
      { text: ' and ' },
      { text: 'i', italic: true }
    ])
  })
})
