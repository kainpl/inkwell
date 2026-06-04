import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  it('always strips scripts and event handlers', () => {
    const out = sanitizeHtml('<p onclick="evil()">hi</p><script>steal()</script>', true)
    expect(out).toContain('hi')
    expect(out).not.toContain('script')
    expect(out).not.toContain('onclick')
  })

  it('strips iframes when embeds are off (default)', () => {
    const out = sanitizeHtml('<iframe src="https://example.com"></iframe>')
    expect(out).not.toContain('iframe')
  })

  it('keeps an https iframe and forces a sandbox when embeds are on', () => {
    const out = sanitizeHtml('<iframe src="https://www.youtube.com/embed/x"></iframe>', true)
    expect(out).toContain('iframe')
    expect(out).toContain('https://www.youtube.com/embed/x')
    expect(out).toContain('sandbox')
  })

  it('drops a non-https iframe src even when embeds are on', () => {
    const out = sanitizeHtml('<iframe src="http://insecure.example/x"></iframe>', true)
    // tag may remain but the unsafe src must be gone
    expect(out).not.toContain('http://insecure.example')
  })

  it('overrides an author-supplied weakened sandbox with the trusted set', () => {
    const out = sanitizeHtml(
      '<iframe src="https://x/y" sandbox="allow-scripts allow-top-navigation allow-popups-to-escape-sandbox"></iframe>',
      true
    )
    expect(out).not.toContain('allow-top-navigation')
    expect(out).not.toContain('allow-popups-to-escape-sandbox')
    expect(out).toContain('allow-presentation') // from our IFRAME_SANDBOX
  })

  it('drops srcdoc on iframes', () => {
    const out = sanitizeHtml('<iframe srcdoc="<b>x</b>"></iframe>', true)
    expect(out).not.toContain('srcdoc')
  })

  it('allows a video element when embeds are on', () => {
    const out = sanitizeHtml('<video controls src="https://x/y.mp4"></video>', true)
    expect(out).toContain('video')
    expect(out).toContain('controls')
  })
})
