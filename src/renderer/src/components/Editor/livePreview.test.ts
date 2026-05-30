import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { Subscript, Superscript } from '@lezer/markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import type { Decoration } from '@codemirror/view'
import {
  buildDecorations,
  BulletWidget,
  TaskCheckboxWidget,
  HrWidget,
  EmojiWidget,
  linkUrlAt,
  headingOffset
} from './livePreview'

interface DecoItem {
  from: number
  to: number
  spec: Decoration['spec']
}

/** Build decorations for a doc with the given active (1-based) line numbers. */
function decorate(doc: string, active: number[] = []): DecoItem[] {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage, extensions: [Subscript, Superscript] })]
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

/** A fully-parsed EditorState for link-resolution tests. */
function parsed(doc: string): EditorState {
  const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage, extensions: [Subscript, Superscript] })] })
  ensureSyntaxTree(state, state.doc.length, 5000)
  return state
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

describe('buildDecorations — blockquotes', () => {
  it('styles every line of a blockquote', () => {
    const items = decorate('> first line\n> second line')
    expect(items.filter((i) => i.spec.class === 'cm-blockquote')).toHaveLength(2)
  })
})

describe('buildDecorations — task lists', () => {
  it('renders a checkbox per task item reflecting its checked state', () => {
    const boxes = decorate('- [x] done\n- [ ] todo')
      .map((i) => i.spec.widget)
      .filter((w): w is TaskCheckboxWidget => w instanceof TaskCheckboxWidget)
    expect(boxes.map((b) => b.checked)).toEqual([true, false])
  })

  it('hides the bullet for task items (the checkbox stands in)', () => {
    const bullets = decorate('- [ ] todo')
      .map((i) => i.spec.widget)
      .filter((w): w is BulletWidget => w instanceof BulletWidget)
    expect(bullets).toHaveLength(0)
  })
})

describe('buildDecorations — horizontal rule & links', () => {
  it('replaces a horizontal rule with an hr widget on idle lines', () => {
    const hrs = decorate('para\n\n---\n\nmore')
      .map((i) => i.spec.widget)
      .filter((w): w is HrWidget => w instanceof HrWidget)
    expect(hrs).toHaveLength(1)
  })

  it('hides the URL of an inline link but keeps the styled label', () => {
    const items = decorate('see [docs](https://x.io) now')
    const hidden = items.filter(
      (i) => i.from !== i.to && i.spec.widget === undefined && i.spec.class === undefined
    )
    expect(hidden.length).toBeGreaterThan(0)
    expect(items.some((i) => i.spec.class === 'ink-link')).toBe(true)
  })

  it('finds the URL of an inline link for ctrl/cmd-click', () => {
    expect(linkUrlAt(parsed('see [docs](https://x.io) now'), 6)).toBe('https://x.io')
  })

  it('resolves a reference link to its definition URL', () => {
    expect(linkUrlAt(parsed('use [Inkwell][repo] here\n\n[repo]: https://r.io'), 6)).toBe(
      'https://r.io'
    )
  })

  it('reads an autolink target', () => {
    expect(linkUrlAt(parsed('ping <https://a.io> ok'), 8)).toBe('https://a.io')
  })

  it('returns the #anchor target for an internal link', () => {
    expect(linkUrlAt(parsed('jump to [tasks](#tasks)'), 10)).toBe('#tasks')
  })

  it('maps an internal anchor to a heading offset', () => {
    expect(headingOffset(parsed('# Tasks\n\nbody'), 'tasks')).toBe(0)
  })
})

describe('buildDecorations — inline extras', () => {
  it('styles highlight, underline, subscript and superscript', () => {
    const classes = decorate('==hi== <u>u</u> H~2~O x^2^')
      .map((i) => i.spec.class)
      .filter(Boolean)
    expect(classes).toContain('ink-highlight')
    expect(classes).toContain('ink-u')
    expect(classes).toContain('ink-sub')
    expect(classes).toContain('ink-sup')
  })

  it('hides an HTML comment on idle lines', () => {
    const hidden = decorate('a <!-- note --> b').filter(
      (i) => i.from !== i.to && i.spec.widget === undefined && i.spec.class === undefined
    )
    expect(hidden.length).toBeGreaterThan(0)
  })

  it('renders emoji shortcodes as emoji on idle lines', () => {
    const widgets = decorate(':tada: party')
      .map((i) => i.spec.widget)
      .filter((w): w is EmojiWidget => w instanceof EmojiWidget)
    expect(widgets).toHaveLength(1)
    expect(widgets[0].char.length).toBeGreaterThan(0)
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
