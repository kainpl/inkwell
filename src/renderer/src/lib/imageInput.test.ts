import {
  extFromMime,
  mimeFromName,
  pastedName,
  imageMarkdown,
  dataUrl,
  parseImage,
  parseHtmlImage,
  toMarkdownImage,
  toHtmlImage
} from './imageInput'

describe('imageInput helpers', () => {
  it('maps known MIME types to extensions, defaulting to png', () => {
    expect(extFromMime('image/jpeg')).toBe('jpg')
    expect(extFromMime('image/svg+xml')).toBe('svg')
    expect(extFromMime('image/unknown')).toBe('png')
  })

  it('infers MIME type from a file name, defaulting to png', () => {
    expect(mimeFromName('photo.JPG')).toBe('image/jpeg')
    expect(mimeFromName('icon.svg')).toBe('image/svg+xml')
    expect(mimeFromName('noext')).toBe('image/png')
  })

  it('builds a pasted file name from MIME + stamp', () => {
    expect(pastedName('image/gif', 123)).toBe('pasted-123.gif')
  })

  it('builds image markdown with optional alt', () => {
    expect(imageMarkdown('assets/a.png', 'cat')).toBe('![cat](assets/a.png)')
    expect(imageMarkdown('assets/a.png')).toBe('![](assets/a.png)')
  })

  it('encodes bytes as a base64 data URL', () => {
    expect(dataUrl('image/png', new Uint8Array([104, 105]))).toBe('data:image/png;base64,aGk=')
  })

  it('parses markdown and HTML image syntax', () => {
    expect(parseImage('![cat](a.png)')).toEqual({ alt: 'cat', src: 'a.png' })
    expect(parseImage('<img src="a.png" alt="cat" width="200" />')).toEqual({
      alt: 'cat',
      src: 'a.png',
      width: 200
    })
  })

  it('parses HTML img with attributes in any order, single quotes', () => {
    expect(parseHtmlImage("<img width='50' src='b.png'>")).toEqual({
      alt: '',
      src: 'b.png',
      width: 50
    })
  })

  it('round-trips markdown <-> HTML, width only in HTML', () => {
    const img = { alt: 'cat', src: 'a.png', width: 120 }
    expect(toHtmlImage(img)).toBe('<img src="a.png" alt="cat" width="120" />')
    expect(toMarkdownImage(img)).toBe('![cat](a.png)')
    expect(toHtmlImage({ alt: '', src: 'a.png' })).toBe('<img src="a.png" />')
  })

  it('ignores non-image text', () => {
    expect(parseImage('just text')).toBeNull()
    expect(parseHtmlImage('<span>x</span>')).toBeNull()
  })
})
