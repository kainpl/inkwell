import { parseOutline } from './outline'

describe('parseOutline', () => {
  it('extracts ATX headings with level, text and character offset', () => {
    const out = parseOutline('# Title\n\n## Section\n')
    expect(out).toEqual([
      { level: 1, text: 'Title', from: 0 },
      { level: 2, text: 'Section', from: 9 }
    ])
  })

  it('ignores hashes inside fenced code blocks', () => {
    const md = '# Real\n```\n# not a heading\n```\n## Also real'
    expect(parseOutline(md).map((h) => h.text)).toEqual(['Real', 'Also real'])
  })

  it('strips trailing closing hashes', () => {
    expect(parseOutline('### Title ###')[0].text).toBe('Title')
  })

  it('strips a custom heading id marker', () => {
    expect(parseOutline('## My Section {#sec}')[0].text).toBe('My Section')
  })

  it('returns nothing for body text without headings', () => {
    expect(parseOutline('just some **text** here')).toEqual([])
  })
})
