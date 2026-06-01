import { useEffect, useState } from 'react'
import { useEditor } from '@renderer/store/useEditor'
import { spellSuggest, learnWord, ignoreWord } from '@renderer/lib/spell'

interface MenuState {
  from: number
  to: number
  word: string
  x: number
  y: number
  suggestions: string[]
}

/**
 * Spell-check suggestions menu. Opens on the `ink:spell-menu` window event
 * emitted when a misspelled word is right-clicked (see Editor/spellCheck.ts).
 */
export default function SpellMenu(): JSX.Element | null {
  const [menu, setMenu] = useState<MenuState | null>(null)

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const d = (e as CustomEvent).detail as Omit<MenuState, 'suggestions'>
      setMenu({ ...d, suggestions: spellSuggest(d.word).slice(0, 8) })
    }
    window.addEventListener('ink:spell-menu', onOpen)
    return () => window.removeEventListener('ink:spell-menu', onOpen)
  }, [])

  if (!menu) return null

  const close = (): void => setMenu(null)
  const replace = (word: string): void => {
    useEditor.getState().view?.dispatch({ changes: { from: menu.from, to: menu.to, insert: word } })
    close()
  }
  const item = 'block w-full px-3 py-1 text-left text-ink hover:bg-accent/10'

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
        className="fixed z-50 max-h-72 min-w-[12rem] overflow-y-auto rounded-md border border-line bg-paper py-1 text-sm shadow-xl"
        style={{ left: menu.x, top: menu.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {menu.suggestions.length === 0 ? (
          <div className="px-3 py-1.5 text-faint">No suggestions</div>
        ) : (
          menu.suggestions.map((s) => (
            <button key={s} onClick={() => replace(s)} className={item}>
              {s}
            </button>
          ))
        )}
        <div className="my-1 border-t border-line" />
        <button
          onClick={() => {
            learnWord(menu.word)
            close()
          }}
          className={item}
        >
          Add to Dictionary
        </button>
        <button
          onClick={() => {
            ignoreWord(menu.word)
            close()
          }}
          className={item}
        >
          Ignore
        </button>
      </div>
    </>
  )
}
