import { speechText } from './tts'

describe('speechText', () => {
  it('uses the selection when non-empty, with markdown stripped', () => {
    expect(speechText('**bold** text', 'whole doc')).toBe('bold text')
  })

  it('falls back to the whole document when there is no selection', () => {
    expect(speechText('   ', '# Title\n\nbody')).toContain('Title')
    expect(speechText('', '# Title\n\nbody')).toContain('body')
    expect(speechText('', '# Title')).not.toContain('#')
  })
})
