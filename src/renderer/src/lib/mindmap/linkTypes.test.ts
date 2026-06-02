import { describe, it, expect } from 'vitest'
import { BUILTIN_LINK_TYPES, mergeLinkTypes, resolveLinkType } from './linkTypes'

describe('link types', () => {
  it('merges manifest overrides + first-class custom over built-ins', () => {
    const r = mergeLinkTypes({
      'depends-on': { label: 'X', color: '#111' },
      custom: { label: 'C', color: '#222', icon: '🚧' }
    })
    expect(r['relates-to']).toEqual(BUILTIN_LINK_TYPES['relates-to']) // untouched built-in
    expect(r['depends-on'].label).toBe('X') // override
    expect(r['depends-on'].directed).toBe(true) // base field kept under override
    expect(r.custom).toMatchObject({ label: 'C', color: '#222', icon: '🚧' }) // custom
  })

  it('resolveLinkType falls back for an unknown type', () => {
    const reg = mergeLinkTypes()
    expect(resolveLinkType(reg, 'nope').color).toBeTruthy()
    expect(resolveLinkType(reg, 'depends-on')).toBe(reg['depends-on'])
  })
})
