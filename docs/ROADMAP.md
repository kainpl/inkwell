# Дорожня карта

Мета — зробити Inkwell **максимально потужним і зручним** редактором Markdown у
дусі Typora: безшовний live-preview, але відкритий, розширюваний і місцями
кращий за оригінал — для письма, редагування, перегляду й друку `.md`.

Карту звірено з **реальною інсталяцією Typora 1.13.6** (`C:\Program Files\Typora`:
повне меню `locales\Base.lproj\Menu.json`, `conf.default.json` і вбудовані docs:
*Markdown Reference, Table Editing, Draw Diagrams, Use Images, Custom Themes,
Auto Save & Version Control*) і з поточним кодом Inkwell.

**Легенда:** ✅ зроблено · 🟡 частково / є заготовка · ⬜ заплановано ·
⭐ — справжня перевага над Typora (у неї цього немає).

> **Робочий принцип:** усе, що впливає на рендер md, **одразу** супроводжуємо
> прикладом у welcome-документі (`resources/Welcome.md`) і юніт-тестом на чисту
> `buildDecorations` (`livePreview.test.ts`). Блок-віджети — через `WidgetType`,
> замінюючи сирий текст **лише на неактивному** блоці.

---

## Фаза 0 — каркас (готово)
- ✅ Electron + electron-vite + React + Tailwind; IPC-контракт; файлові операції; нативне меню
- ✅ CodeMirror 6 + базовий live-preview (H1–H6, **strong**, *em*, ~~strike~~, `code`, посилання)
- ✅ Маркери проявляються на активному рядку (`activeLines` + `Decoration.replace`)
- ✅ Сайдбар, дерево файлів (лінива підвантаж), аутлайн, статус-бар, світла/темна теми, focus mode
- ✅ Фікс preload (`index.mjs`) + `StartupError` замість «білого екрана»
- ✅ Тестова інфраструктура: Vitest (+ jsdom, RTL), coverage, ESLint flat-config
- ✅ Guard на незбережені зміни (перед open/new/close) — також у Фазі 4

## Фаза 1 — інлайн live-preview (ядро Typora-відчуття)
- ✅ **Списки** марк./нумер.: булети за глибиною `•/◦/▪`, видимі номери, hanging-indent
- ✅ **Цитати `>`**: маркер ховається; треба стиль блоку (ліва лінія, відступ) + вкладені
- ✅ **Task list `- [ ]`/`- [x]`**: клікабельний чекбокс, що міняє джерело (toggle / mark complete)
- ✅ **Горизонтальна лінія `---`/`***`** → `<hr>`-віджет
- ✅ **Посилання**: ховати `[..](url)` → лейбл; Ctrl/⌘+клік відкриває; **reference/implicit** посилання; **внутрішні якорі на заголовки** (`#heading`); автолінк `<url>` і «голих» URL
- ✅ **Underline** `<u>..</u>` (raw-HTML інлайн, як у Typora)
- ✅ **Highlight `==..==`, Sub `~..~`, Sup `^..^`, Comment** — за прапорцем у налаштуваннях (як у Typora)
- ✅ **Emoji** `:smile:` з автодоповненням (тригер ESC / автоматично)
- ✅ **Input rules (магія набору)**: маркери (`# `/`- `/`> `/`---`) рендеряться миттєво через live-preview; Enter-скаффолди — `|a|b|`→таблиця, ` ``` `→код-блок, `$$`→math-блок; авто-обгортка виділення `**`/`*`/`` ` `` (closeBrackets)
- ✅ **Авто-продовження списків/цитат** (Enter, авто-інкремент, Tab/Shift+Tab — рівні; порожній пункт виходить)
- ✅ **Авто-пари** дужок/лапок/маркерів і обгортання виділеного
- ✅ **Розумне виділення**: Select Word / Line / Sentence / Styled Scope (як у меню Typora)

## Фаза 2 — блокові віджети
- **Зображення** (велике, розбито на під-пункти):
  - ✅ рендер `![alt](src)` віджетом на неактивному рядку; **відносні шляхи** від теки документа (`file://`); http/data/blob; авто-центр одиночного зображення; raw на активному рядку
  - ✅ **paste з буфера** + **drag&drop** із копіюванням у теку `assets/` (fallback на data:URI для незбереженого документа)
  - ✅ **resize** (drag-ручка → `width` у HTML-img) + рендер HTML-`<img>` тегів із шириною
  - ✅ **zoom/magnify** (клік → повноекранний оверлей, Esc/клік закриває)
  - ✅ перемикання **md⇄HTML-синтаксису** (меню Format / команда)
  - ✅ **upload** на хостинг через настроювану shell-команду (як у Typora; UID-команда в сторі, UI — у Preferences/Фаза 6)
- ✅ **Code fence**: **підсвітка синтаксису** (вкладені мови `language-data` + повна палітра syntax-кольорів у `theme.ts`/CSS-змінних для світла/темна) + фон/рамка блоку, бейдж мови, кнопка **copy**; ` ``` `-фенси **ховаються на неактивному блоці** (Typora-стиль), розкриваються коли каретка в блоці
  - ✅ підсвітка коду в **експорті** HTML/PDF/Image — highlight.js у рушії `exportRender` + hljs github-CSS
- ✅ **Таблиці** (велике): рендер GFM-таблиці як HTML на неактивному блоці (вирівнювання `:` враховане); редагування через меню **Format → Table** (додати/видалити рядок/стовпець, вирівнювання) — чиста модель `tableModel` + команди `tableCommands`, джерело генерується авто
  - ⬜ інлайн-тулбар над таблицею + перетягування меж стовпців (зручність — додамо у Фазі 7)
- ✅ **Математика**: інлайн `$..$` і блок `$$..$$` через **KaTeX**; рендер на неактивному рядку, raw для редагування; помилки показуються червоним
- **Діаграми**:
  - ✅ **mermaid** (` ```mermaid `): async-рендер SVG на неактивному блоці, raw для редагування, тема за світлим/темним режимом, помилки червоним
  - ⬜ легасі-движки **flowchart.js** (` ```flow `) / **js-sequence** (` ```sequence `) — застарілі, mermaid їх покриває; додамо лише за потреби
  - ⬜ вмикання прапорцем (Preferences/Фаза 6); включення діаграм в експорт (Фаза 5)
- ✅ **GitHub-alert / callout блоки**: Note / Tip / Important / Warning / Caution — кольорова смужка + лейбл, `[!TYPE]` ховається на неактивному рядку
- ✅ **Виноски** `[^1]`: рендер посилання як надрядкового номера + спливна підказка з тексту визначення
- ✅ **YAML front matter**: визначення `---…---` на початку документа → акуратний моноширинний блок метаданих (лишається редагованим)
- ✅ **TOC `[toc]`**: авто-генерація змісту зі заголовків, оновлення наживо, клік скролить до заголовка; raw на активному рядку
- ✅ **HTML-блок** passthrough: рендер **санітизованого** HTML (DOMPurify) на неактивному рядку, raw для редагування
  - ⬜ `<iframe>`/`<video>` ембеди — потребують послаблення CSP + allowlist у санітайзері (відкладено: суперечить strict-CSP; зробимо опційно у Preferences/Фаза 6)

## Фаза 3 — навігація й режими письма
- ✅ **Source Code Mode** (увесь документ у сирому md без декорацій) — toggle `Ctrl+Shift+E` / меню / статус-бар (через CM-compartment)
- ✅ Focus mode
- ✅ **Typewriter mode** (активний рядок по центру скролом) — toggle `F9` / меню / статус-бар
- ✅ **Outline**: згортуваний (per-heading + Expand/Collapse All), підсвітка поточного заголовка за кареткою. **Живе вкладкою сайдбара** (не окремою правою панеллю) — `Ctrl+/` / іконка в TitleBar перемикають сайдбар на вкладку Outline; містить також **Backlinks**-секцію
  - ⬜ popover-варіант аутлайну — за потреби у Фазі 7
- ✅ **Сайдбар**: дві вкладки — **Files** і **Outline**. *Files* — дерево файлів (керування + git) з полем фільтра й перемикачем сортування зверху: порожній фільтр + A–Z показує дерево, а введення фільтра або «Recent» перемикає на плоский крос-папковий список md (за назвою / за свіжістю з relative-time). *(Articles злито у Files; права Outline-панель прибрана — `OutlineView`/`FilesPanel`.)*
  - ✅ **Перетягувана ширина сайдбара**: ресайз мишкою за тонкою ручкою на внутрішній грані (`ResizeHandle`, `cursor-col-resize`, без анімації під час drag), межі 160–520px, ширина зберігається в налаштуваннях (`sidebarWidth`). Перевірено наживо (drag → 320px, persist у localStorage)
- ✅ **Пошук/заміна** в документі (`@codemirror/search`: панель угорі, `Ctrl+F`/`Ctrl+H`, regex, підсвітка)
- ✅ **Глобальний пошук** по теці (`Ctrl/⌘+Shift+F`) ⭐ — рекурсивно по всіх md, результати по файлах із рядками, клік відкриває й скролить до місця
- ✅ **Jump To**: Top (`Ctrl+Home`) / Bottom (`Ctrl+End`) через меню
- ✅ **Open Quickly** (`Ctrl/⌘+P`) — fuzzy-перемикач файлів (чистий `fuzzy`-matcher, ↑/↓/Enter/Esc)
- ✅ Лічильник слів/символів + **час читання** у статус-барі (чистий `textStats`)
  - ⬜ **Word count popover** (детально: слова/символи без пробілів/рядки) + **ціль за словами** — розширимо у Фазі 7
- ✅ Always on Top (checkbox-меню), Full Screen, перемикання масштабу (zoom in/out/actual)

## Фаза 4 — файли та надійність
- ✅ **Guard незбережених змін** (in-app модал Save/Don't Save/Cancel)
- ✅ Індикатор «брудного» документа — крапка в TitleBar + «Unsaved/Saved» у StatusBar
- ✅ **Заголовок вікна + іконка застосунку**: OS-заголовок/таскбар = `<тайтл> — Inkwell`, де *тайтл* — перший заголовок документа (як в оглавленні), інакше ім'я файлу без розширення; `•` спереду коли є незбережені зміни (чистий `windowTitle` з тестами, оновлюється через `document.title`). Власна іконка (крапля чорнила) замість дефолтної електронівської — згенерована без зовнішніх інструментів (`scripts/gen-icon.mjs`, чистий Node/zlib → `resources/icon.png` + багаторозмірний `icon.ico`), підхоплюється вікном і electron-builder. Перевірено наживо (`win.getTitle()` для heading/файлу/dirty, наявність іконки)
- ✅ **Автозбереження** (debounce 1.5s → `fs.writeFile`; лише для збереженого файлу, перемикач у меню File + статус-бар; чистий `autoSave` з тестами)
- ✅ **Recover Unsaved Drafts** — debounce-снапшоти у `userData/drafts` поки документ «брудний»; при старті пропонує відновити найновіший стан, що відрізняється від диска (чистий `drafts` з тестами)
- ✅ **Browse All Versions** — локальна історія версій документа: снапшот на кожне збереження (дедуп ідентичних, кап 50) у `userData/versions/<id>`; пікер File → Browse All Versions… з прев'ю й Restore (чисті `shared/versions` з тестами)
- ✅ **Open Recent** (File → Open Recent, пікер) + **Reopen Closed File** (`Ctrl+Shift+T`) — список у localStorage, чистий `recentFiles` з тестами
  - ✅ **Recent Locations** (нещодавні теки): об'єднаний пікер **Recent** із двома секціями — *Folders* (відкривають воркспейс через `openFolderByPath`) і *Files* (відкривають документ); недавні теки запам'ятовуються при відкритті папки (діалог / стартовий екран / відновлення сесії), зниклі шляхи відпадають зі списку. Плюс **стартовий екран** у сайдбарі, коли тека не відкрита: кнопка *Open Folder…* + короткий список недавніх тек і файлів. Зберігання в localStorage (`recentFolders`), той самий чистий `recentFiles`-хелпер. Перевірено наживо: старт-екран, модалка з обома секціями, клік по теці відкриває й піднімає її у списку
  - ⬜ **Save All**, **New Window** — потребують мульти-вікно (Фаза 9)
- ✅ **Вкладки відкритих файлів** (мульти-док): завжди видимий таб-бар, dirty-індикатор + × на кожній; **повний стан на вкладку** (вміст + undo-історія + курсор/скрол через `Map<id, EditorState>`); відкриття додає вкладку (без guard), guard переїхав на закриття вкладки/вікна; File → Close закриває активну. Чистий `tabsModel` + tab-екшени стора + інтеграційний тест свопу станів
- ✅ **Close / Close Folder** (File): Close закриває активну вкладку (остання → Welcome); Close Folder — усі вкладки + тека → Welcome (guard по кожній брудній вкладці)
- ✅ **Відновлення сесії** (останній документ + тека при старті через localStorage)
  - ✅ **відновлення позиції каретки** при reopen — per-file офсет у localStorage (кап 200), зберігається debounce на зміну виділення, відновлюється при відкритті файлу/сесії (чистий `getCaret/setCaret` + інтеграційний тест)
- ✅ Дії над файлами в дереві (контекст-меню): New File/Folder, Rename, Duplicate, Delete (у кошик ОС), Reveal in File Manager; in-app prompt для імен, авто-оновлення дерева
  - ✅ **Move To** (контекст-меню дерева): folder-picker → `fs.rename` з unique-name й захистом від переміщення в підтеку себе; оновлює відкриті вкладки (`updateTabPath`, ним же тепер користується Rename)
- ✅ **Line Endings** CRLF/LF (меню File) + **Insert Final Newline on Save** — чистий `saveOptions` (нормалізація при записі), з тестами
  - ⬜ Reopen with Encoding (не-UTF-8) — рідко потрібне, додамо за запитом
- ✅ **Стеження за змінами файлу на диску** + перезавантаження/конфлікт: `fs.watch` у main (ігнорує власні записи через `lastWritten`); чистий буфер тихо перезавантажується, «брудний» — питає Reload/Keep Mine; видалення файлу робить буфер «брудним» (чистий `externalChangeAction` з тестами)
- ✅ **Асоціації файлів** (відкриття `.md`/`.markdown`/`.mdown`/`.mkd` подвійним кліком): декларація `fileAssociations` в `electron-builder.yml` (реєструється при встановленні запакованої аппки); у main — single-instance lock + `open-file` (macOS) + парсинг argv (Win/Linux, чистий `fileFromArgv` з тестами) → IPC у рендер → `openPath`. Перевірено наживо ланцюг відкриття; OS-реєстрація — після пакування

## Фаза 5 — експорт і друк
> **Фундамент (5.1):** рушій `doc → standalone HTML` (`exportRender.ts`: markdown-it
> + плагіни footnote/task-lists/sub/sup/mark/texmath-KaTeX + власні rules emoji/
> alerts/`[toc]`/mermaid→SVG + вбудовування зображень у data-URI + DOMPurify),
> світла `export.css`. Реюзають усі виходи нижче.
- ✅ **Export HTML** (with styles / without styles) — меню File → Export ▸; самодостатній HTML
- ✅ **Export PDF** (`printToPDF` в offscreen-вікні) + **Page Setup** (папір A4/Letter/A5/Custom, поля, орієнтація, розрив на H1 — модалка + стан у сторі) + **Print** (системний діалог). Чисті `pageSetup`/`exportRender` з тестами; PDF-пайплайн перевірено наживо
- ✅ **Copy as** (Edit → Copy As): **Markdown** / **HTML** (формат у Word/Docs) / **Plain Text** (`renderPlainText`) / **Image** (PNG у буфер) — через системний clipboard
- ✅ **Export Image** (PNG): повний-сторінковий PNG через offscreen-вікно + `capturePage` (вся висота документа, з DPI-масштабом); File → Export ▸ Image. Спільний `renderToImage` для експорту й Copy as Image
- ✅ **Export через pandoc**: Word (.docx) / OpenDocument (.odt) / RTF / EPUB / LaTeX — читає md-джерело `gfm+tex_math_dollars`, `--resource-path` для зображень
  - ✅ ⭐ **pandoc on-demand** (`main/pandoc.ts`): якщо немає на PATH — пропонує завантажити з офіційного GitHub-релізу, розпаковує системним `tar` (bsdtar: zip/tar.gz без зайвих залежностей), кешує в `userData/pandoc/`, валідує. Прогрес-оверлей у рендері. Перевірено наживо: завантаження 3.9.0.2 → кеш → конвертація md→docx. Прибирає ручну залежність — **перевага над Typora** (там pandoc ставиш сам)
- ✅ підсвітка коду в експорті (highlight.js) — у рушії
- ✅ Налаштування експорту — 5.5: **вбудовування ресурсів** (перемикач *Embed images*) + **CSS-тема експорту** (Preferences ▸ Export → *Default* / *Match theme*: експорт успадковує палітру активної теми через живі токени + github-dark для коду в темних темах; підхоплює `themes/export.user.css`). PDF/зображення йдуть із того ж HTML — один стиль на всі формати

## Фаза 6 — теми й оформлення
- ✅ **Світло/темні редакції тем**: тема = назва + до 2 редакцій (`light`/`dark`); стан `theme`+`mode`, кнопка перемикає редакцію й дізейблиться, якщо редакція одна. CSS: `[data-theme=x]` (світла) + `[data-theme=x].dark` (темна)
- ✅ Кілька **вбудованих тем** — 6.2 (+редакції): `lib/themes.ts` + палітри в `index.css`, перемикач у Preferences ▸ Appearance, кнопка mode в TitleBar. Готові з обома редакціями: **Inkwell** (дефолт, був Light/Dark) / **GitHub** / **Newsprint** / **Pixyll** / **Tokyo** (був Night, тепер +Tokyo Day). Старі id (`light`/`dark`/`night`) мігрують у `theme`+`mode`
- ✅ **Зовнішні `.css`-теми** — 6.3 (+редакції): тека `userData/themes/` (сід `README`+`example.css`), скан у дропдаун (`main/ipc/themes.ts`), інжекція через `<style>`, **гаряче перезавантаження** (`fs.watch`). Дизайнер кладе в один файл `:root{світла}` + `:root.dark{темна}`; `parseThemeEditions` визначає редакції (legacy `inkwell: dark` = лише темна). Path-traversal id валідовано
- ✅ Каскад `base.user.css` + `{theme}.user.css` — 6.3: `base.user.css` завжди поверх активної теми, `{theme}.user.css` — лише для неї (як у Typora). Перевірено наживо
- ✅ **Типографіка**: шрифт редактора (serif/sans/mono + **вшитий JetBrains Mono** через `@fontsource`), ширина «сторінки», міжрядковий інтервал, розмір — застосовуються живими CSS-змінними через CM-тему; зберігаються у `localStorage` (`lib/settings.ts` + `settingsSync.ts`)
  - ✅ auto-hide menu bar (Windows/Linux; перемикач у Preferences ▸ Appearance, застосовується в main через IPC)
- ✅ Панель **Preferences** (Edit → Preferences…, `Ctrl/⌘ ,`): секції **Appearance / Editor / Markdown / Image / Export**
- ✅ **Markdown-прапорці**: вмикання/вимикання фіч (math, mermaid, footnotes, sub/sup, ==highlight==, emoji, alerts, [toc]) — діють і в **живому редакторі** (гейтинг у `buildDecorations` + форс-перерахунок StateField через `refreshPreview`-ефект), і в **експорті** (умовні markdown-it плагіни + DOM-постобробка). Вимкнена фіча показується сирим текстом. Перевірено наживо: тогл emoji миттєво перемальовує редактор
- ✅ **Повне покриття markdownguide.org** (Basic + Extended): аудит проти сайту → дороблено прогалини. **Нові рендер-фічі:** custom **heading IDs** `{#id}` (ховаються в редакторі, `id` в експорті, навігація `[..](#id)` працює і в редакторі), **definition lists** (`Term`/`: def` — терм жирний, визначення з відступом; експорт `markdown-it-deflist`). **Insert-UI для всіх уже-рендерених фіч**, що її не мали: footnote, sub/sup, inline/block math, mermaid, alert (5 типів), `[toc]`, **Headings 4–6** — у Format-меню, палітрі й тулбарі. Bare-URL автолінк уже працював (GFM). Чисті хелпери з тестами; зразки у Welcome. Перевірено наживо (скріншот: `{#id}` сховано, deflist стилізовано, кнопки на місці)

## Фаза 7 — продуктивність і power-user
- ✅ **Панель інструментів для новачків** ⭐: фіксований toolbar + спливаюча над виділенням + меню **Format** + **emoji-пікер** (перемикач `Ctrl/⌘+Shift+B`); набір розширюється з кожною новою фічею
- ✅ **Команда-палітра** (`Ctrl/⌘ Shift+P`) ⭐: fuzzy-пошук усіх команд (File/Edit/Format/View/Export/Go) — реєстр `lib/commands.ts` перевипускає наявні menu-канали через IPC `triggerMenu` (нуль дублювання логіки). Fuzzy-перемикач файлів лишається у Quick Open (`Ctrl/⌘ P`), палітра дає на нього команду *Go to File…*. Перевірено наживо
- ✅ **Smart Punctuation** (за прапорцем у Preferences ▸ Editor, дефолт off): прямі лапки→типографські `“”`/`‘’`, `--`→`–`, `---`→`—`, `...`→`…` під час набору; пропускає код (`inCode`-guard по дереву). Чистий `smartReplace` з тестами; CM `inputHandler` перед `closeBrackets`. Перевірено наживо
- ✅ **Перевірка орфографії** (hunspell через `nspell`, check-while-typing, Learn Word): підкреслення помилок хвилястою лінією (CM ViewPlugin по видимих рядках, пропускає код), правий клік → підказки + **Add to Dictionary** (вивчені слова в `localStorage`) / **Ignore**. Англійська вшита (`dictionary-en`), решта (вкл. **українську**) — on-demand завантаження з `wooorm/dictionaries` + кеш у `userData` (як pandoc). **Кілька мов одночасно** (по чекеру на мову; слово правильне, якщо є хоч в одному словнику) — мультивибір у Preferences ▸ Editor. Перевірено наживо: `hello привіт wrld пррвт` з активними en+uk → підкреслено лише `wrld`,`пррвт`
  - ⬜ **граматика** — окремо (hunspell не вміє; потрібен LanguageTool)
- ✅ **Кастомні Search Services** (контекст-меню «Search With…»): праве-клік на виділенні/слові → єдине контекст-меню редактора (spell-підказки + Cut/Copy/Paste + Search With) → пошук у браузері (`shell.openExternal`, `%s`=запит); список сервісів редагується у Preferences ▸ Editor. Перевірено наживо: `Search "hello world" with Google` → `…?q=hello%20world`
- ✅ **Кастомні гарячі клавіші**: у Preferences ▸ Keyboard кожній команді можна призначити хоткей (захоплення натисканням, `keyComboToCM` з тестами); застосовується CM-keymap-ом найвищого пріоритету через Compartment (реконфіг на зміну), виконує команду через `triggerMenu`. Перевірено наживо: `Ctrl+Shift+D` → Toggle Sidebar. *(OS перехоплює клавіші, уже зайняті меню-акселераторами — кастомні додають нові шорткати)*
- ✅ **Мультикурсор**: `drawSelection` + `allowMultipleSelections` у CM-стеку; Alt-клік додає курсор, `Ctrl/⌘ D` (наступне входження), `Ctrl/⌘ Alt ↑/↓` (курсор вище/нижче) — також у командній палітрі. Перевірено наживо (3 карети)
- ✅ **Clear Format** (зняти інлайн-форматування з виділення) + **Prettify Source** (підрівняти джерело: хвостові пробіли, відступ заголовків, злиття порожніх рядків, фінальний newline; код-фенси недоторкані) — у Format-меню й палітрі; чисті хелпери з тестами
  - ✅ **TTS** (View ▸ Start/Stop Speaking + палітра): читає виділення або весь документ через Web Speech API (`speechSynthesis`, без залежностей), Markdown знятий (`renderPlainText`). Перевірено наживо (speaking on/off)
- ✅ **Шаблони документів**: тека `userData/templates/*.md` (сід *Meeting Notes* + *Blog Post*), **File ▸ New from Template…** + палітра → fuzzy-пікер створює новий чернетковий документ із вмісту шаблону; токен `{date}` підставляється. `main/ipc/templates.ts`, path-traversal валідовано

## Фаза 9 — «понад Typora» (наші диференціатори ⭐)
> Вкладки, кілька вікон і історія версій у Typora **вже є** — це паритет (фази 3–4),
> не перевага. Справжні переваги:
- ⬜ **Plugin / extension API** — у Typora немає взагалі
- ✅ **Wiki-links `[[..]]`** (Obsidian-стиль) — ядро: `[[Note]]`/`[[Note|alias]]` рендеряться як клікабельні лінки (дужки сховані на неактивному рядку), **Ctrl/⌘-клік** відкриває нотатку (або **створює**, якщо нема), **автодоповнення** після `[[` зі списку нотаток воркспейсу, **backlinks**-секція в Outline-панелі (хто посилається на поточну). Чисті `parseWikiLink`/`wikiTargetAt` з тестами. Перевірено наживо. ✅ **граф нотаток** (View ▸ Note Graph… + палітра): модалка з force-directed SVG-графом зв'язків `[[..]]` по всьому воркспейсу — вузол на нотатку, ребро на посилання (alias зводиться до цілі, self-/missing-лінки відкидаються), клік по вузлу відкриває нотатку. Власна силова симуляція без залежностей (`main/ipc/graph.ts` обходить `.md`, чистий `buildNoteGraph` з тестами; авто-fit viewBox). Перевірено наживо: 3 вузли / 3 ребра, кліки відкривають
- ✅ **Git** у дереві файлів: бейджі статусу (M/A/?/D/R/U) у FileTree через `git status --porcelain` (`main/ipc/git.ts`, `execFile` без shell), мапінг шляхів на абсолютні `/`-шляхи, рефреш на зміну теки + після збереження; не-репо → без бейджів. Чистий `gitStatusChar` з тестами. Перевірено наживо (M + ? у тестовому репо). ✅ **базові git-дії** (View ▸ Source Control… / `Ctrl+Shift+G` / палітра): модалка Source Control у стилі VS Code — гілка, секції **Staged Changes** / **Changes** (по файлу: stage `+` / unstage `−`, та Stage All / Unstage All), поле повідомлення + **Commit**; бейджі дерева синхронізуються після кожної дії. Розбір `--porcelain=v1 --branch` чистим `parseGitChanges` (X=index/staged, Y=worktree/unstaged, `MM`→в обидві секції, rename→нова назва, **ahead/behind**) з тестами; усі мутації через `execFile` (cwd=корінь репо). Перевірено наживо: staged b.md / changes a.md+c.md, stage+commit → `git log` містить коміт, дерево чисте. ✅ **Push / Pull** (кнопки в панелі з ↑ahead/↓behind, мережеві команди з 60s-таймаутом, auth через git credential helper користувача) + **індикатор гілки в статус-барі** (`⎇ branch ↑a ↓b`, клік відкриває Source Control — робить git помітним без шорткату). Перевірено наживо на локальному bare-remote: ahead=1 → push → ahead=0; remote-зміна → pull → файл прийшов
- ✅ **Багатомовний UI** (Typora — лише англійський інтерфейс): English (дефолт) / Українська / Російська, перемикач у Preferences ▸ General. Власний рушій без залежностей — пласкі словники з крапковими ключами у `src/shared/i18n/` (спільні для main і renderer), `translate(locale, key, vars?)` з `{var}`-інтерполяцією й фолбеком en→ключ. Renderer: хук `useT()` (підписка на `locale` у сторі → миттєвий перемал) + імперативний `t()` для не-компонентного коду; налаштування `locale` персиститься (`settingsSync`) і пушиться в main по IPC `setLocale`, що **перебудовує нативне меню**. Покрито все: нативне меню (~110 рядків), TitleBar/StatusBar/Sidebar/TabBar/StartScreen, командна палітра (заголовки+категорії, locale-aware fuzzy), уся Preferences, усі модалки (Quick Open / Search / Recent / Source Control / Note Graph / Drive Connect / Page Setup / Confirm / Prompt / завантаження), контекст-меню дерева й редактора, тулбари, emoji-пікер, мітки markdown-фіч і мов орфографії. Тест покриття ключів (uk/ru дзеркалять кожен en-ключ) + тест реактивності перемикання. Перевірено: typecheck/lint/build зелені, 366 тестів
- ⬜ **AI-асист** (продовження / рерайт / переклад / summary виділення)
- ⬜ **Відкритий код і розширюваність** (Typora — закрита й платна)
- ⬜ **Real-time співпраця** (далекий горизонт)

## Звірено веб-дослідженням (verified) і важелі проти Typora

Підтверджені факти Typora 1.13.x (джерела — support.typora.io, high-confidence):

- **Тригери створення:** таблиця — рядок `| a | b |` + Enter (вирівнювання
  двокрапками `:--`/`:-:`/`--:`, md-джерело генерується авто); math-блок — `$$`
  + Enter; код — ` ``` ` + Enter.
- **Гарячі клавіші — дзеркалити для паритету:** Table `Ctrl+T`, Code Fence
  `Ctrl+Shift+K`, Math Block `Ctrl+Shift+M`, Hyperlink `Ctrl+K`, Image
  `Ctrl+Shift+I`, Source Mode `Ctrl+/`, Focus `F8`, Typewriter `F9`
  (на macOS — Cmd/Opt-варіанти). Закласти типову розкладку + кастомні keybindings.
- **Math = MathJax v3** (не KaTeX). **Експорт:** HTML / PDF / image — нативні
  (PDF: A4/A5/custom-папір, поля, розрив сторінки на H1); **усе інше (docx, odt,
  rtf, epub, latex, mediawiki, rst, textile, opml) — лише через окремо
  встановлений pandoc.**
- **Теми = чистий CSS** у теці тем; каскад у 4 шари: базові → тема →
  `base.user.css` → `{theme}.user.css`.
- **Auto-pair** поширюється на md-символи і (умовно) на `=`/`$`/`^`.

**Наші важелі (зробити краще за Typora):**

- ⭐ **KaTeX замість MathJax** — швидший рендер; цього давно просять користувачі Typora.
- ✅⭐ **Вбудований експортер** (docx/epub/…) — pandoc тягнеться on-demand, ручна залежність прибрана (Фаза 5.4).
- ⭐ Решта — Фаза 8 (plugin API, wiki-links + backlinks + граф, git, AI, відкритий код).

> Веб-пас не зміг адъюдикувати (0-0, мертві URL) частину пунктів, але **локальні
> docs Typora їх підтверджують**: візуальний тулбар таблиць + контекст-меню
> рядків/стовпців; рушії діаграм — js-sequence (` ```sequence `), flowchart.js
> (` ```flow `), mermaid (` ```mermaid `: flowchart/sequence/gantt); ~5 вбудованих
> тем (github/newsprint/night/pixyll/whitey); inline-math/sub/sup/highlight/діаграми
> вмикаються прапорцем у налаштуваннях.
>
> Натомість веб-розділ «скарги/обмеження Typora» **не дав підтверджених фактів** —
> наші диференціатори (Фаза 8: tabs-quirks, plugin API, wiki-links/backlinks/граф,
> perf на великих файлах, collab) спираються на загальні знання, а не на цей пас;
> їх варто окремо підтвердити форумами/рев'ю перед скоупом.

**Джерела:** support.typora.io — `/Markdown-Reference/`, `/Table-Editing/`,
`/Math/`, `/Shortcut-Keys/`, `/Focus-and-Typewriter-Mode/`; локальна інсталяція
Typora 1.13.6 (`Menu.json`, вбудовані docs).

## Технічний борг / нотатки
- `livePreview` віддає декорації через **`StateField`**, не `ViewPlugin`: CodeMirror
  забороняє блок-віджети й replace через межі рядків (таблиці, mermaid/HTML-блоки,
  багаторядковий `$$`-math) у view-плагінах — інакше кидає виняток і ламає рендер.
  Тому декоруємо **весь документ** (без `visibleRanges`). Перевірка в реальному
  `EditorView`: `rendercheck.test.ts`. Оптимізація (split: інлайн у плагін за
  `visibleRanges` + блоки у полі) — за потреби на великих файлах.
- Логіка декорацій — у чистій `buildDecorations(state, ranges, active)` під юніт-тести
  без DOM. Тримати цей патерн.
- Низку елементів Typora вмикає **прапорцем у налаштуваннях** (inline math, sub/sup,
  highlight, diagrams, callouts) — закласти такий самий перемикач у Preferences.
- Розглянути винесення рушія декорацій в окремий модуль, якщо розростеться.
- TODO: розпакувати `app.asar` Typora для звірки нюансів поведінки (за потреби).
```
