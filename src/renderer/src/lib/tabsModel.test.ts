import { type Tab, findByPath, isReplaceable, closeTab } from './tabsModel'

function tab(over: Partial<Tab>): Tab {
  return { id: 'x', path: null, name: 'Untitled.md', content: '', dirty: false, ...over }
}

describe('findByPath', () => {
  const tabs = [tab({ id: 'a', path: '/a.md' }), tab({ id: 'b', path: '/b.md' })]
  it('finds an open tab by path', () => {
    expect(findByPath(tabs, '/b.md')?.id).toBe('b')
  })
  it('never matches a null path (untitled tabs stay distinct)', () => {
    expect(findByPath([...tabs, tab({ id: 'c', path: null })], null)).toBeUndefined()
  })
})

describe('isReplaceable', () => {
  it('is true for a pristine untitled tab', () => {
    expect(isReplaceable(tab({ path: null, dirty: false }))).toBe(true)
  })
  it('is false when dirty or saved', () => {
    expect(isReplaceable(tab({ path: null, dirty: true }))).toBe(false)
    expect(isReplaceable(tab({ path: '/a.md', dirty: false }))).toBe(false)
    expect(isReplaceable(undefined)).toBe(false)
  })
})

describe('closeTab', () => {
  const tabs = [tab({ id: 'a' }), tab({ id: 'b' }), tab({ id: 'c' })]
  it('activates the right neighbour', () => {
    expect(closeTab(tabs, 'b')).toEqual({ tabs: [tabs[0], tabs[2]], activeId: 'c' })
  })
  it('activates the new last tab when closing the last', () => {
    expect(closeTab(tabs, 'c').activeId).toBe('b')
  })
  it('activates the first when closing the first', () => {
    expect(closeTab(tabs, 'a').activeId).toBe('b')
  })
  it('returns null active when the list empties', () => {
    expect(closeTab([tab({ id: 'a' })], 'a')).toEqual({ tabs: [], activeId: null })
  })
  it('is a no-op for an unknown id', () => {
    expect(closeTab(tabs, 'zzz')).toEqual({ tabs, activeId: null })
  })
})
