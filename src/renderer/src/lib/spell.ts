import nspell from 'nspell'
import { useAppStore } from '@renderer/store/useAppStore'

/**
 * Spell-check engine (nspell). English is bundled (a lazy Vite `?raw` chunk);
 * other languages are downloaded + cached by the main process. One active
 * checker at a time; the plugin reads it via `getChecker`. `startSpellSync`
 * loads/reloads it as the setting and language change, bumping `spellVersion`
 * so the editor re-decorates.
 */

export interface SpellLanguage {
  code: string
  label: string
}

/** Selectable languages (`en` bundled, the rest downloaded on demand). */
export const SPELL_LANGUAGES: SpellLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru', label: 'Russian' }
]

type Checker = ReturnType<typeof nspell>
/** One checker per active language. A word is correct if ANY of them accepts it. */
const checkers = new Map<string, Checker>()
const ignored = new Set<string>()
let loadToken = 0

export function hasCheckers(): boolean {
  return checkers.size > 0
}

/** Correct if ignored this session, no checker is loaded yet, or any accepts it. */
export function spellCorrect(word: string): boolean {
  if (ignored.has(word) || checkers.size === 0) return true
  for (const c of checkers.values()) if (c.correct(word)) return true
  return false
}

/** Merged suggestions across all active languages (deduped). */
export function spellSuggest(word: string): string[] {
  const out: string[] = []
  for (const c of checkers.values()) {
    for (const s of c.suggest(word)) if (!out.includes(s)) out.push(s)
  }
  return out
}

/** Ignore a word for this session only (not persisted). */
export function ignoreWord(word: string): void {
  ignored.add(word)
  useAppStore.getState().bumpSpellVersion()
}

/** Add a word to every active dictionary (this session + persisted). */
export function learnWord(word: string): void {
  for (const c of checkers.values()) c.add(word)
  useAppStore.getState().addLearnedWord(word)
  useAppStore.getState().bumpSpellVersion()
}

async function loadDict(lang: string): Promise<{ aff: string; dic: string } | null> {
  // English is read from the bundled dictionary in the main process; other
  // languages are downloaded + cached there. Either way, one IPC call.
  const d = await window.api.getSpellDict(lang)
  return d.aff && d.dic ? d : null
}

/** Reconcile the loaded checkers with the active language set. */
async function syncCheckers(): Promise<void> {
  const token = ++loadToken
  const { spellCheck, spellLanguages, learnedWords } = useAppStore.getState()
  const want = new Set(spellCheck ? spellLanguages : [])

  for (const lang of [...checkers.keys()]) if (!want.has(lang)) checkers.delete(lang)
  for (const lang of want) {
    if (checkers.has(lang)) continue
    const dict = await loadDict(lang).catch(() => null)
    if (token !== loadToken) return // a newer sync superseded this one
    if (!dict) continue
    try {
      const sp = nspell(dict.aff, dict.dic)
      for (const w of learnedWords) sp.add(w)
      checkers.set(lang, sp)
    } catch {
      /* a malformed dictionary shouldn't break the others */
    }
    useAppStore.getState().bumpSpellVersion()
  }
  useAppStore.getState().bumpSpellVersion()
}

/**
 * Keep the loaded checkers in sync with the spell-check setting + language set.
 * Returns an unsubscribe function.
 */
export function startSpellSync(): () => void {
  let lastCheck = useAppStore.getState().spellCheck
  let lastLangs = useAppStore.getState().spellLanguages.join(',')
  void syncCheckers()

  return useAppStore.subscribe(() => {
    const { spellCheck, spellLanguages } = useAppStore.getState()
    const langs = spellLanguages.join(',')
    if (spellCheck === lastCheck && langs === lastLangs) return
    lastCheck = spellCheck
    lastLangs = langs
    void syncCheckers()
  })
}
