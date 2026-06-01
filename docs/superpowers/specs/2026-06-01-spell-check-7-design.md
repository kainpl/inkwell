# Phase 7 — Spell check (configurable + on-demand dictionaries)

## Scope

Offline spelling via hunspell dictionaries (`nspell`). English is bundled; other
languages (incl. Ukrainian) download on demand and cache, like pandoc. Off by
default. **Grammar is out of scope** (hunspell can't do it; it stays a separate
roadmap item needing LanguageTool).

## Engine + dictionaries

- `nspell(aff, dic)` → `.correct(word)`, `.suggest(word)`, `.add(word)`.
- **English (bundled):** the renderer dynamically imports
  `dictionary-en/index.aff?raw` + `index.dic?raw` (a lazy Vite chunk — offline, no
  fs). Loaded only when spell check turns on.
- **Other languages (on-demand):** `main/ipc/spell.ts` downloads
  `dictionaries/<lang>/index.aff` + `index.dic` from the `wooorm/dictionaries`
  GitHub raw tree via `net.fetch` (renderer CSP can't), caches under
  `userData/dictionaries/<lang>/`, and returns the two strings. Progress is
  pushed like pandoc.

## Renderer — `lib/spell.ts`

- `loadDictionary(lang)`: en → dynamic raw import; else IPC `getSpellDict`.
  Build an `nspell`, add the user's learned words, cache the instance.
- Active checker held in a module singleton + a small store of state (loading /
  ready / language). `check(word)`, `suggest(word)`, `learn(word)`.

## Editor integration — `Editor/spellCheck.ts`

- A `ViewPlugin` (inline marks are legal from plugins) that, debounced, scans the
  **visible** ranges, tokenises words (`/[\p{L}’']+/u`), skips code (syntax tree)
  and checks each; misspellings get a `Decoration.mark` with a wavy-underline
  class (`.ink-misspelled`). Recomputes when the checker becomes ready / the doc
  changes. No-op when spell check is off or no checker is ready.
- **Suggestions:** a `contextmenu` handler on `.ink-misspelled` opens a small
  React menu (`SpellMenu`) with `suggest(word)` replacements, **Add to
  Dictionary** (learn + persist), and **Ignore once**. Clicking replaces the word.

## Settings / UI

`settings.ts` + store: `spellCheck: boolean` (default false), `spellLanguage`
(default `en`), `learnedWords: string[]`. Preferences ▸ Editor: enable checkbox +
language `<select>` (bundled `en` + a known list; choosing an uncached language
triggers a download with the pandoc-style progress overlay).

## Verification

Unit tests: word tokeniser + the misspelled-range computation over a fake checker;
`lib/spell` language→source mapping. Live: enable English, a misspelling gets
underlined and right-click suggests + learns; download Ukrainian and check a UK
word.
