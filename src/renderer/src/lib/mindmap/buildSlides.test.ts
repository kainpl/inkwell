import { describe, it, expect } from 'vitest'
import { buildSlides } from './buildSlides'
import { buildGraph } from './buildGraph'
import { markdownToOutline } from '@shared/mindmap/mindMapMarkdown'

describe('buildSlides', () => {
  it('makes a slide per node with children (title + direct-child bullets)', () => {
    const md = '# R\n\n- A\n  - A1\n  - A2\n- B\n'
    const slides = buildSlides(buildGraph(markdownToOutline(md).outline))
    // R (children A, B) and A (children A1, A2) are sections; B and the leaves are not
    expect(slides.map((s) => s.title)).toEqual(['R', 'A'])
    expect(slides[0].bullets).toEqual(['A', 'B'])
    expect(slides[1].bullets).toEqual(['A1', 'A2'])
  })

  it('falls back to one slide for a flat map', () => {
    const slides = buildSlides(buildGraph(markdownToOutline('- A\n- B\n- C\n').outline))
    expect(slides).toHaveLength(1)
    expect(slides[0].bullets).toEqual(['A', 'B', 'C'])
  })
})
