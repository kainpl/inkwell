import { smartReplace } from './smartPunctuation'

describe('smartReplace', () => {
  it('opens a double quote at start / after space, closes otherwise', () => {
    expect(smartReplace('', '"')).toEqual({ from: 0, insert: '“' })
    expect(smartReplace('say ', '"')).toEqual({ from: 0, insert: '“' })
    expect(smartReplace('word', '"')).toEqual({ from: 0, insert: '”' })
  })

  it('handles single quotes and apostrophes', () => {
    expect(smartReplace('', "'")).toEqual({ from: 0, insert: '‘' })
    expect(smartReplace('don', "'")).toEqual({ from: 0, insert: '’' })
  })

  it('progresses dashes: -- → en, --- → em', () => {
    expect(smartReplace('a-', '-')).toEqual({ from: 1, insert: '–' })
    expect(smartReplace('a–', '-')).toEqual({ from: 1, insert: '—' })
    expect(smartReplace('a', '-')).toBeNull()
  })

  it('turns ... into an ellipsis', () => {
    expect(smartReplace('..', '.')).toEqual({ from: 2, insert: '…' })
    expect(smartReplace('a.', '.')).toBeNull()
  })

  it('ignores other characters', () => {
    expect(smartReplace('x', 'a')).toBeNull()
  })
})
