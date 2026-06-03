import { describe, it, expect } from 'vitest'
import { projectVersionId } from './projectVersionId'

describe('projectVersionId', () => {
  it('is null for an untitled (empty) path', () => {
    expect(projectVersionId('')).toBeNull()
  })
  it('is stable for the same path', () => {
    expect(projectVersionId('/a/b/p.inkproj')).toBe(projectVersionId('/a/b/p.inkproj'))
  })
  it('differs for different paths', () => {
    expect(projectVersionId('/a/p.inkproj')).not.toBe(projectVersionId('/a/q.inkproj'))
  })
  it('matches the filesystem-safe version id pattern', () => {
    for (const p of ['C:\\Users\\x\\My Project.inkproj', '/tmp/проєкт.inkproj', '/a/b c/d.inkproj']) {
      expect(projectVersionId(p)).toMatch(/^[A-Za-z0-9_-]{1,128}$/)
    }
  })
})
