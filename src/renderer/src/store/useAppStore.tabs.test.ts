import { useAppStore } from './useAppStore'

const get = (): ReturnType<typeof useAppStore.getState> => useAppStore.getState()
const activeTab = (): { content: string; dirty: boolean } => {
  const s = get()
  return s.tabs.find((t) => t.id === s.activeId)!
}

beforeEach(() => {
  useAppStore.setState({
    tabs: [{ id: 'init', path: null, name: 'Welcome.md', content: '', dirty: false }],
    activeId: 'init',
    doc: { path: null, name: 'Welcome.md', content: '', dirty: false }
  })
})

describe('tab actions', () => {
  it('replaces a pristine tab when opening the first file', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    expect(get().tabs).toHaveLength(1)
    expect(get().tabs[0].path).toBe('/a.md')
    expect(get().doc).toMatchObject({ path: '/a.md', content: 'A', dirty: false })
  })

  it('opens a second file in a new tab', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    get().openInTab({ path: '/b.md', name: 'b.md', content: 'B' })
    expect(get().tabs).toHaveLength(2)
    expect(get().doc.path).toBe('/b.md')
  })

  it('focuses an already-open tab instead of duplicating', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    get().openInTab({ path: '/b.md', name: 'b.md', content: 'B' })
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    expect(get().tabs).toHaveLength(2)
    expect(get().doc.path).toBe('/a.md')
  })

  it('newTab adds an untitled tab and activates it', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    get().newTab()
    expect(get().tabs).toHaveLength(2)
    expect(get().doc).toMatchObject({ path: null, name: 'Untitled.md' })
  })

  it('setContent marks the active tab dirty and mirrors into the list', () => {
    get().setContent('typed')
    expect(get().doc.dirty).toBe(true)
    expect(activeTab()).toMatchObject({ content: 'typed', dirty: true })
  })

  it('removeTab activates the right neighbour', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    get().openInTab({ path: '/b.md', name: 'b.md', content: 'B' })
    const aId = get().tabs[0].id
    const bId = get().tabs[1].id
    get().activateTab(aId)
    get().removeTab(aId)
    expect(get().tabs).toHaveLength(1)
    expect(get().activeId).toBe(bId)
    expect(get().doc.path).toBe('/b.md')
  })

  it('removeTab on the last tab spawns a fresh untitled', () => {
    get().removeTab(get().activeId)
    expect(get().tabs).toHaveLength(1)
    expect(get().doc.path).toBeNull()
  })

  it('removeTab on a background tab keeps the active one', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    get().openInTab({ path: '/b.md', name: 'b.md', content: 'B' }) // active = b
    const aId = get().tabs[0].id
    get().removeTab(aId) // close background a
    expect(get().tabs).toHaveLength(1)
    expect(get().doc.path).toBe('/b.md')
  })

  it('updateTabPath renames the matching tab and mirrors the active doc', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    get().updateTabPath('/a.md', '/sub/a.md', 'a.md')
    expect(get().tabs[0].path).toBe('/sub/a.md')
    expect(get().doc.path).toBe('/sub/a.md')
  })

  it('updateTabPath updates a background tab without touching the active doc', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    get().openInTab({ path: '/b.md', name: 'b.md', content: 'B' }) // active = b
    const aId = get().tabs[0].id
    get().updateTabPath('/a.md', '/moved/a.md', 'a.md')
    expect(get().tabs.find((t) => t.id === aId)!.path).toBe('/moved/a.md')
    expect(get().doc.path).toBe('/b.md')
  })

  it('resetTabs collapses to a single untitled tab', () => {
    get().openInTab({ path: '/a.md', name: 'a.md', content: 'A' })
    get().openInTab({ path: '/b.md', name: 'b.md', content: 'B' })
    get().resetTabs()
    expect(get().tabs).toHaveLength(1)
    expect(get().doc.path).toBeNull()
  })
})
