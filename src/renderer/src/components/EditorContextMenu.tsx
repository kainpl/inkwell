import { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { useEditor } from '@renderer/store/useEditor'
import { spellSuggest, learnWord, ignoreWord } from '@renderer/lib/spell'
import { useT } from '@renderer/lib/i18n'

interface Detail {
  x: number
  y: number
  word: string | null
  from: number | null
  to: number | null
  misspelled: boolean
  hasSelection: boolean
  query: string
}
type MenuState = Detail & { suggestions: string[] }

/**
 * The editor's right-click menu (replaces the native one when there's a word or
 * selection). Shows spell suggestions + Add to Dictionary / Ignore on a
 * misspelled word, Cut/Copy/Paste, and "Search With…" the configured services.
 * Opened by the `ink:context-menu` event from Editor/spellCheck.ts.
 */
export default function EditorContextMenu(): JSX.Element | null {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const services = useAppStore((s) => s.searchServices)
  const t = useT()

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const d = (e as CustomEvent).detail as Detail
      setMenu({ ...d, suggestions: d.misspelled && d.word ? spellSuggest(d.word).slice(0, 8) : [] })
    }
    window.addEventListener('ink:context-menu', onOpen)
    return () => window.removeEventListener('ink:context-menu', onOpen)
  }, [])

  if (!menu) return null

  const close = (): void => setMenu(null)
  const replace = (word: string): void => {
    if (menu.from != null && menu.to != null) {
      useEditor.getState().view?.dispatch({ changes: { from: menu.from, to: menu.to, insert: word } })
    }
    close()
  }
  const exec = (cmd: string): void => {
    useEditor.getState().view?.focus()
    document.execCommand(cmd)
    close()
  }
  const search = (url: string): void => {
    window.api.openExternalUrl(url.replace('%s', encodeURIComponent(menu.query)))
    close()
  }
  const item = 'block w-full px-3 py-1 text-left text-ink hover:bg-accent/10'
  const sep = <div className="my-1 border-t border-line" />

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        onMouseDown={close}
        onContextMenu={(e) => {
          e.preventDefault()
          close()
        }}
      />
      <div
        className="fixed z-50 max-h-[70vh] min-w-[12rem] overflow-y-auto rounded-md border border-line bg-paper py-1 text-sm shadow-xl"
        style={{ left: menu.x, top: menu.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {menu.misspelled && (
          <>
            {menu.suggestions.length ? (
              menu.suggestions.map((s) => (
                <button key={s} onClick={() => replace(s)} className={item}>
                  {s}
                </button>
              ))
            ) : (
              <div className="px-3 py-1 text-faint">{t('ectx.noSuggestions')}</div>
            )}
            {sep}
            <button
              onClick={() => {
                if (menu.word) learnWord(menu.word)
                close()
              }}
              className={item}
            >
              {t('ectx.addToDict')}
            </button>
            <button
              onClick={() => {
                if (menu.word) ignoreWord(menu.word)
                close()
              }}
              className={item}
            >
              {t('ectx.ignore')}
            </button>
            {sep}
          </>
        )}
        {menu.hasSelection && (
          <>
            <button onClick={() => exec('cut')} className={item}>
              {t('ectx.cut')}
            </button>
            <button onClick={() => exec('copy')} className={item}>
              {t('ectx.copy')}
            </button>
          </>
        )}
        <button onClick={() => exec('paste')} className={item}>
          {t('ectx.paste')}
        </button>
        {menu.query && services.length > 0 && (
          <>
            {sep}
            <div className="truncate px-3 py-0.5 text-[11px] text-faint">
              {t('ectx.searchWith', { q: menu.query.slice(0, 24) })}
            </div>
            {services.map((sv) => (
              <button key={sv.name} onClick={() => search(sv.url)} className={item}>
                {sv.name}
              </button>
            ))}
          </>
        )}
      </div>
    </>
  )
}
