import { DEFAULT_PAGE_SETUP, pdfOptions, loadPageSetup, savePageSetup } from './pageSetup'

describe('pdfOptions', () => {
  it('maps a named paper + margins (mm → inches)', () => {
    const o = pdfOptions({ ...DEFAULT_PAGE_SETUP, paper: 'A4', margin: 25.4 })
    expect(o.pageSize).toBe('A4')
    expect(o.landscape).toBe(false)
    expect((o.margins as { top: number }).top).toBeCloseTo(1) // 25.4mm = 1in
  })

  it('maps custom paper to inch dimensions and landscape', () => {
    const o = pdfOptions({
      ...DEFAULT_PAGE_SETUP,
      paper: 'Custom',
      customW: 254,
      customH: 127,
      orientation: 'landscape'
    })
    expect(o.landscape).toBe(true)
    expect(o.pageSize).toEqual({ width: 10, height: 5 })
  })
})

describe('page setup persistence', () => {
  beforeEach(() => localStorage.clear())

  it('returns defaults when nothing is stored', () => {
    expect(loadPageSetup()).toEqual(DEFAULT_PAGE_SETUP)
  })

  it('round-trips a saved setup, merging onto defaults', () => {
    savePageSetup({ ...DEFAULT_PAGE_SETUP, paper: 'Letter', margin: 12 })
    const loaded = loadPageSetup()
    expect(loaded.paper).toBe('Letter')
    expect(loaded.margin).toBe(12)
    expect(loaded.orientation).toBe('portrait')
  })
})
