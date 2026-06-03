import { useEffect, useState } from 'react'

/** Module-level cache: `workingDir|path` → data URI (assets are immutable per path). */
const cache = new Map<string, string>()

/**
 * Resolve a bundle `assets/…` path to a `data:` URI via the main process, cached.
 * Returns `''` until loaded. The async load only bumps a render counter (state is set
 * in the promise, never synchronously in the effect) and reads come straight from the cache.
 */
export function useAssetDataUri(workingDir: string | null, path: string | undefined): string {
  const key = workingDir && path ? `${workingDir}|${path}` : ''
  const [, bump] = useState(0)

  useEffect(() => {
    if (!key || !workingDir || !path || cache.has(key)) return
    let cancelled = false
    void window.api.inkproj
      .readAssetDataUri(workingDir, path)
      .then((uri) => {
        if (cancelled) return
        cache.set(key, uri)
        bump((n) => n + 1)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [key, workingDir, path])

  return key ? cache.get(key) ?? '' : ''
}
