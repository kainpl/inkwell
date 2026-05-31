# Phase 7 — Smart Punctuation

## Goal

Optional typographic substitution as you type: straight quotes → curly,
`--` → en-dash, `---` → em-dash, `...` → ellipsis. Off by default, toggled in
Preferences ▸ Editor. Skipped inside code (so literal punctuation survives).

## Substitutions

| Type | Becomes | Rule |
|------|---------|------|
| `"` | " / " | opening after start/space/`([{`, else closing |
| `'` | ' / ' | opening after start/space, else closing (apostrophe) |
| `-` after `-` | – (en) | second dash |
| `-` after `–` | — (em) | third dash (progressive) |
| `.` after `..` | … | third dot |

## Implementation

`components/Editor/smartPunctuation.ts`:
- `smartReplace(before, ch) → { from, insert } | null` — pure, unit tested.
  `before` is up to 2 chars before the caret; `from` = how many of them to also
  replace.
- `smartPunctuation(): Extension` — an `EditorView.inputHandler` that, when the
  setting is on and the caret is a plain insertion (`from === to`, one char),
  skips code nodes (`/Code/` in the syntax-tree ancestry), computes `smartReplace`
  and dispatches the substitution. Reads the flag from the store.

Wired into `markdownExtensions` (high enough to run before default input).

## Settings / UI

`settings.ts` + store gain `smartPunctuation: boolean` (default `false`), synced
via `settingsSync`; a checkbox in Preferences ▸ Editor.

## Verification

Unit tests for `smartReplace` (quotes open/close, en/em progression, ellipsis,
no-op for other chars). Live: typing quotes/dashes/dots transforms in prose,
stays literal in a code block, and does nothing when the flag is off.
