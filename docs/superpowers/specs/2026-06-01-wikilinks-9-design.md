# Phase 9 — Wiki-links (core)

Obsidian-style `[[Note]]` links. Core slice: render + click-to-open/create +
autocomplete + a backlinks list. The note **graph** is a separate later slice.

## Syntax

`[[Note Name]]` and `[[Note Name|alias]]`. Pure `parseWikiLink` /
`wikiTargetAt` (regex `\[\[([^\]|\n]+)(\|([^\]\n]+))?\]\]`) — unit tested.

## Rendering (live preview)

`Editor/wikiLinks.ts` exports `wikiLinkDecos(...)`, called from
`buildDecorations`. On an idle line it hides `[[`, the `target|` of an aliased
link, and `]]`, and styles the visible text `.ink-wikilink` (accent, pointer).
On the active line the raw `[[…]]` shows for editing — the existing Typora
pattern.

## Open / create

`wikiLinkClick` (a `domEventHandlers`) opens a note on Ctrl/Cmd-click, like
markdown links. `lib/wikiNote.ts` `openWikiNote(name)`: find a workspace `.md`
whose basename matches (case-insensitive) and `openPath` it; otherwise
`createFile` it in the workspace root and open it.

## Autocomplete

`wikiLinkCompletion` (a `CompletionSource`, like emoji): after `[[`, suggest
workspace note names (`listArticles`), applying `[[Name]]`. `[` is removed from
`closeBrackets` so `[[` doesn't auto-pair and fight the completion.

## Backlinks

`OutlinePanel` gains a "Backlinks" section for the current note: `searchInFolder`
for `[[<name>` across the workspace, filtered to real links, listed with the file
name; clicking opens the file. Recomputed when the active document changes.

## Verification

Unit tests for `parseWikiLink` / `wikiTargetAt`. Live: a `[[Note]]` renders as a
link, Ctrl/Cmd-click opens (or creates) it, `[[` autocompletes from the folder,
and a backlink appears for a note that links to the current one.
