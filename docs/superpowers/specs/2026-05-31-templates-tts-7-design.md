# Phase 7 — Document templates + Text-to-Speech

## Document templates

Drop `.md` files into `userData/templates/`; **File ▸ New from Template…**
(and a command) opens a fuzzy picker; choosing one creates a new untitled,
dirty document seeded with that file's content. Mirrors the themes folder.

- `main/ipc/templates.ts` (`registerTemplateIpc`): `listTemplates → { id, name }[]`
  (scan `*.md`), `readTemplate(id) → string`, `openTemplatesFolder`. Seeds two
  example templates on first run. Ids validated (no separators / `..`); paths
  confined to the folder.
- `shared/ipc.ts`: channels + `TemplateEntry { id, name }` + `menuNewFromTemplate`.
- `components/TemplatePicker.tsx`: QuickOpen-style modal; Enter →
  `newDocumentFromTemplate(content)`.
- `lib/docActions.ts`: `newDocumentFromTemplate(content)` = `newTab()` +
  `setContent(content)` (so the new doc is dirty and prompts to save).

## Text-to-Speech

**View ▸ Start Speaking / Stop Speaking** (and commands) read the document aloud
via the Web Speech API (`speechSynthesis`, built into Electron — no deps).

- `lib/tts.ts`: `startSpeaking()` speaks the selection if any, else the whole
  document, with Markdown stripped (`renderPlainText`) for natural speech;
  `stopSpeaking()` cancels. Pure `speechText(selection, docContent)` chooses and
  strips the source — unit tested.
- `shared/ipc.ts`: `menuStartSpeaking`, `menuStopSpeaking`.
- `menu.ts` + `App.tsx` + `commands.ts` wire them like the other commands.

## Verification

Unit tests: `speechText` (selection vs whole-doc, markdown stripped); template id
validation reuse. Live: New from Template creates a seeded doc; Start/Stop
Speaking begins/ends speech (`speechSynthesis.speaking`).
