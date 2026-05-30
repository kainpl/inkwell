import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import type { Decoration } from '@codemirror/view'
import { buildDecorations, BulletWidget } from './livePreview'

interface DecoItem {
  from: number
  to: number
  spec: Decoration['spec']
}

/** Build decorations for a doc with the given active (1-based) line numbers. */
function decorate(doc: string, active: number[] = []): DecoItem[] {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })]
  })
  // Force a full synchronous parse so syntaxTree() is complete headlessly.
  ensureSyntaxTree(state, state.doc.length, 5000)

  const set = buildDecorations(state, [{ from: 0, to: state.doc.length }], new Set(active))
  const items: DecoItem[] = []
  const cursor = set.iter()
  while (cursor.value) {
    items.push({ from: cursor.from, to: cursor.to, spec: cursor.value.spec })
    cursor.next()
  }
  return items
}

function bullets(items: DecoItem[]): BulletWidget[] {
  return items
    .map((i) => i.spec.widget)
    .filter((w): w is BulletWidget => w instanceof BulletWidget)
}

describe('buildDecorations — lists', () => {
  it('renders a bullet widget for an unordered item on an inactive line', () => {
    const found = bullets(decorate('- milk'))
    expect(found).toHaveLength(1)
    expect(found[0].glyph).toBe('•')
  })

  it('uses depth-aware glyphs for nested unordered lists', () => {
    const glyphs = bullets(decorate('- a\n  - b\n    - c')).map((w) => w.glyph)
    expect(glyphs).toEqual(['•', '◦', '▪'])
  })

  it('keeps ordered numbers visible (styled, not replaced by a widget)', () => {
    const items = decorate('1. first\n2. second')
    expect(bullets(items)).toHaveLength(0)
    expect(items.filter((i) => i.spec.class === 'ink-list-number')).toHaveLength(2)
  })

  it('shows the raw marker (dimmed) on the active line', () => {
    const items = decorate('- milk', [1])
    expect(bullets(items)).toHaveLength(0)
    expect(items.some((i) => i.spec.class === 'ink-mark')).toBe(true)
  })

  it('tags list lines with the hanging-indent class', () => {
    expect(decorate('- milk').some((i) => i.spec.class === 'ink-li')).toBe(true)
  })
})

describe('buildDecorations — headings & inline', () => {
  it('tags heading lines with size classes', () => {
    expect(decorate('# Title').some((i) => i.spec.class === 'ink-h1')).toBe(true)
  })

  it('styles bold and hides its emphasis markers on inactive lines', () => {
    const items = decorate('a **bold** b')
    expect(items.some((i) => i.spec.class === 'ink-strong')).toBe(true)
    // The ** markers become empty replace decorations (no widget, no class).
    const hiddenMarks = items.filter(
      (i) => i.from !== i.to && i.spec.widget === undefined && i.spec.class === undefined
    )
    expect(hiddenMarks.length).toBeGreaterThan(0)
  })
})
