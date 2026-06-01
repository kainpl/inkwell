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
let checker: Checker | null = null
let loadedLang = ''
let loadToken = 0
const ignored = new Set<string>()

export function getChecker(): Checker | null {
  return checker
}

/** Whether a word is spelled correctly (or ignored this session). */
export function spellCorrect(word: string): boolean {
  return !checker || ignored.has(word) || checker.correct(word)
}

/** Ignore a word for this session only (not persisted). */
export function ignoreWord(word: string): void {
  ignored.add(word)
  useAppStore.getState().bumpSpellVersion()
}

async function loadDict(lang: string): Promise<{ aff: string; dic: string } | null> {
  // English is read from the bundled dictionary in the main process; other
  // languages are downloaded + cached there. Either way, one IPC call.
  const d = await window.api.getSpellDict(lang)
  return d.aff && d.dic ? d : null
}

async function activate(lang: string): Promise<void> {
  const token = ++loadToken
  const dict = await loadDict(lang).catch(() => null)
  if (token !== loadToken) return // a newer activation started
  checker = dict ? nspell(dict.aff, dict.dic) : null
  loadedLang = checker ? lang : ''
  if (checker) for (const w of useAppStore.getState().learnedWords) checker.add(w)
  useAppStore.getState().bumpSpellVersion()
}

export function spellSuggest(word: string): string[] {
  return checker ? checker.suggest(word) : []
}

/** Add a word to the dictionary (this session + persisted) and re-decorate. */
export function learnWord(word: string): void {
  checker?.add(word)
  useAppStore.getState().addLearnedWord(word)
  useAppStore.getState().bumpSpellVersion()
}

/**
 * Keep the active checker in sync with the spell-check setting + language.
 * Returns an unsubscribe function.
 */
export function startSpellSync(): () => void {
  let lastCheck = useAppStore.getState().spellCheck
  let lastLang = useAppStore.getState().spellLanguage
  if (lastCheck) void activate(lastLang)

  return useAppStore.subscribe(() => {
    const { spellCheck, spellLanguage } = useAppStore.getState()
    if (spellCheck === lastCheck && spellLanguage === lastLang) return
    lastCheck = spellCheck
    lastLang = spellLanguage
    if (spellCheck && spellLanguage !== loadedLang) void activate(spellLanguage)
    else useAppStore.getState().bumpSpellVersion()
  })
}
