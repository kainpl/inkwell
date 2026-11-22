let theme: 'dark' | 'default' | undefined
let nextId = 0

export async function renderMermaid(code: string, dark: boolean): Promise<{ svg?: string; error?: string }> {
  try {
    const { default: mermaid } = await import('mermaid')
    const nextTheme = dark ? 'dark' : 'default'
    if (theme !== nextTheme) {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: nextTheme, suppressErrorRendering: true })
      theme = nextTheme
    }
    const { svg } = await mermaid.render('ink-mermaid-' + ++nextId, code)
    return { svg }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
