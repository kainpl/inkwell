import { createHash } from 'node:crypto'

/**
 * PKCE S256 code challenge for a verifier (base64url, unpadded). Pure but
 * depends on `node:crypto`, so this module is **main-only** — never import it
 * from renderer code (keep `./drive` crypto-free for the web bundle).
 */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}
