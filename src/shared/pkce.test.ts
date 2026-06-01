import { createHash } from 'node:crypto'
import { pkceChallenge } from './pkce'

describe('pkceChallenge', () => {
  it('derives a base64url S256 challenge from the verifier', () => {
    const verifier = 'abc123XYZ-_~.'
    const expected = createHash('sha256').update(verifier).digest('base64url')
    expect(pkceChallenge(verifier)).toBe(expected)
  })

  it('returns base64url (no +, /, or = padding)', () => {
    expect(pkceChallenge('another-verifier-value-0123456789')).not.toMatch(/[+/=]/)
  })
})
