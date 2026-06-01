import { EditorState } from '@codemirror/state'
import { parseWikiLink, wikiTargetAt } from './wikiLinks'

describe('parseWikiLink', () => {
  it('parses a plain wiki-link', () => {
    expect(parseWikiLink('[[Note]]')).toEqual({ target: 'Note', display: 'Note' })
  })

  it('parses an aliased wiki-link', () => {
    expect(parseWikiLink('[[Note Name|shown]]')).toEqual({ target: 'Note Name', display: 'shown' })
  })

  it('returns null for non-links', () => {
    expect(parseWikiLink('[single]')).toBeNull()
    expect(parseWikiLink('text')).toBeNull()
  })
})

describe('wikiTargetAt', () => {
  const st = (doc: string): EditorState => EditorState.create({ doc })

  it('returns the target when the position is inside a link', () => {
    expect(wikiTargetAt(st('see [[My Note]] here'), 8)).toBe('My Note')
  })

  it('returns null outside any link', () => {
    expect(wikiTargetAt(st('see [[My Note]] here'), 1)).toBeNull()
  })

  it('uses the target, not the alias, of an aliased link', () => {
    expect(wikiTargetAt(st('[[Target|alias]]'), 5)).toBe('Target')
  })
})
