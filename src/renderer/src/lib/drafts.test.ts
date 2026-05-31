import { draftId, isRecoverable, newestDraft } from './drafts'
import type { DraftEntry } from '@shared/ipc'

function draft(over: Partial<DraftEntry>): DraftEntry {
  return { id: 'x', docPath: '/a.md', name: 'a.md', content: 'hi', savedAt: 1, ...over }
}

describe('draftId', () => {
  it('is stable for the same path', () => {
    expect(draftId('/home/u/note.md')).toBe(draftId('/home/u/note.md'))
  })
  it('differs for different paths', () => {
    expect(draftId('/a/note.md')).not.toBe(draftId('/b/note.md'))
  })
  it('uses a fixed id for the unsaved document', () => {
    expect(draftId(null)).toBe('untitled')
  })
  it('produces a filesystem-safe id', () => {
    expect(draftId('C:\\Users\\x\\My Notes\\f.md')).toMatch(/^[a-zA-Z0-9-]+$/)
  })
})

describe('isRecoverable', () => {
  it('recovers when draft differs from disk', () => {
    expect(isRecoverable(draft({ content: 'new' }), 'old')).toBe(true)
  })
  it('skips when draft equals disk', () => {
    expect(isRecoverable(draft({ content: 'same' }), 'same')).toBe(false)
  })
  it('skips empty drafts', () => {
    expect(isRecoverable(draft({ content: '   ' }), null)).toBe(false)
  })
  it('recovers an unsaved draft (no disk content)', () => {
    expect(isRecoverable(draft({ content: 'typed', docPath: null }), null)).toBe(true)
  })
})

describe('newestDraft', () => {
  it('returns null for an empty list', () => {
    expect(newestDraft([])).toBeNull()
  })
  it('picks the highest savedAt', () => {
    const a = draft({ id: 'a', savedAt: 10 })
    const b = draft({ id: 'b', savedAt: 30 })
    const c = draft({ id: 'c', savedAt: 20 })
    expect(newestDraft([a, b, c])?.id).toBe('b')
  })
})
