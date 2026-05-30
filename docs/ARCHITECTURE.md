# Архітектура

## Три процеси Electron

```
┌─────────────────────────────┐      IPC       ┌──────────────────────────────┐
│  main (Node.js)             │  invoke/handle │  renderer (Chromium + React) │
│  • BrowserWindow            │ ◀────────────▶ │  • UI, стор, CodeMirror      │
│  • нативне меню             │   send/on      │  • НЕ має прямого доступу     │
│  • файлова система (fs)     │                │    до fs/node                │
└─────────────┬───────────────┘                └──────────────┬───────────────┘
              │                                                │
              │              ┌──────────────────┐              │
              └──────────────│  preload          │──────────────┘
                             │  contextBridge → │
                             │  window.api       │
                             └──────────────────┘
```

- **main** (`src/main`) — створює вікно, будує меню, тримає всі звернення до
  диска (`ipc/files.ts`). Меню не виконує логіку саме — воно лише шле події в
  renderer (`win.webContents.send(...)`).
- **preload** (`src/preload`) — єдиний місток. Через `contextBridge` віддає в
  renderer вузький типізований об'єкт `window.api`. `contextIsolation: true`,
  `nodeIntegration: false`.
- **renderer** (`src/renderer`) — React-застосунок. Уся робота з файлами — лише
  через `window.api`. Жодного `require('fs')` тут немає й бути не повинно.

Контракт IPC (імена каналів + типи) живе в одному файлі — `src/shared/ipc.ts`,
який імпортують усі три сторони. Це прибирає «магічні рядки» й розсинхрон типів.

## Потік даних

### Відкриття файлу
1. Користувач тисне `Ctrl/⌘ O` → main шле `menu:openFile` у renderer.
2. `App.tsx` ловить подію → `window.api.openFileDialog()`.
3. preload → main (`dialog:openFile`) → діалог + `fs.readFile` → повертає
   `{ path, name, content }`.
4. `loadDoc(...)` кладе документ у стор.
5. `Editor.tsx` помічає зміну `doc.content` у сторі й заливає її в CodeMirror
   через `dispatch` (із захистом від «луни», див. нижче).

### Редагування
1. CodeMirror `updateListener` на кожну зміну кличе `onChange(value)`.
2. `setContent(value)` оновлює стор і ставить `dirty: true`.
3. `OutlinePanel` і `StatusBar` перераховуються з нового `content`.

### Збереження
`Ctrl/⌘ S` → `menu:save` → якщо є `doc.path`, то `fs.writeFile`; інакше —
діалог «Зберегти як». Після успіху — `markSaved()` (скидає `dirty`).

## Стор (Zustand)

`store/useAppStore.ts` — єдине джерело стану renderer:
- `doc` — поточний документ (`path`, `name`, `content`, `dirty`);
- `root` — корінь відкритої теки (дерево `FileNode`);
- UI-прапорці — `theme`, `sidebarOpen`, `outlineOpen`, `focusMode`,
  `typewriterMode`.

Читання — селекторами: `useAppStore(s => s.doc.name)`. Дії в обробниках подій —
імперативно: `useAppStore.getState().save()`.

## Рушій редактора (CodeMirror 6)

Стек розширень збирається в `markdownExtensions.ts`:
`markdown(GFM)` + підсвітка коду (`language-data`) + тема + **`livePreview`** +
`highlightActiveLine` + перенос рядків + `updateListener`.

`livePreview.ts` — ключове. Це `ViewPlugin`, який тримає `DecorationSet` і
перебудовує його на `docChanged | selectionSet | viewportChanged`. Він ходить
по Lezer-дереву Markdown у межах видимих діапазонів і додає декорації:

- **рядкові** (`Decoration.line`) — клас розміру для заголовків;
- **інлайнові** (`Decoration.mark`) — стилі для `**`, `*`, `` ` ``, `~~`,
  посилань;
- **приховування** (`Decoration.replace`) — ховає маркери розмітки на
  **неактивних** рядках; на активному рядку замість приховування ставиться
  приглушений клас `ink-mark`.

«Активність» рядка визначається з `view.state.selection` у `activeLines()`.

Уся візуалка винесена в `index.css` (`.cm-*`, `.ink-*`) і працює на CSS-змінних
теми — тому перемикання світла/темряви не торкається логіки рушія.

### Чому такий підхід (а не ProseMirror/TipTap)
CodeMirror зберігає **точний** Markdown-сорс як джерело істини й лише *показує*
його як документ. Це дає безпроблемний round-trip (відкрив → зберіг — байти ті
самі), рідну поведінку «маркери проявляються на активному рядку» (як у Typora) і
повний контроль над текстом. ProseMirror — це повноцінний WYSIWYG із власною
моделлю документа; конвертація в/з Markdown там завжди трохи лосі. Деталі — у
`docs/DECISIONS.md`.

## Захист від «луни» (echo loop)

`Editor.tsx` тримає `lastPushed` — останнє значення, яке ми **самі** залили в
редактор. Підписка на стор заливає новий `content` у CodeMirror лише якщо він
відрізняється і від `lastPushed`, і від поточного тексту редактора. Інакше
правка користувача → стор → назад у редактор зациклилася б.

## Темізація

Токени кольорів — CSS-змінні в `:root` та `.dark` (`index.css`). Tailwind мапить
їх у семантичні кольори (`paper`, `ink`, `muted`, `line`, `accent`, `chrome`).
Нову тему додають як `:root[data-theme="..."]` з тим самим набором змінних — код
чіпати не треба.
