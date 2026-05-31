import mermaid from 'mermaid'

/**
 * Thin async wrapper around mermaid. Initialized lazily on first use so the
 * heavy library is only touched when a diagram actually appears. Theme follows
 * the app's light/dark mode via the `dark` flag passed by the caller.
 */
let initialized = false
let counter = 0

function ensureInit(dark: boolean): void {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'default'
  })
  initialized = true
}

/** Unique id for each render (mermaid requires a DOM-id-safe string). */
function nextId(): string {
  counter += 1
  return 'ink-mermaid-' + counter
}

/**
 * Render mermaid `code` to an SVG string. Resolves with `{ svg }` on success or
 * `{ error }` with a message on failure — never throws.
 */
export async function renderMermaid(
  code: string,
  dark: boolean
): Promise<{ svg?: string; error?: string }> {
  ensureInit(dark)
  try {
    const { svg } = await mermaid.render(nextId(), code)
    return { svg }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
