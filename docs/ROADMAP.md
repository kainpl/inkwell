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
  - ⬜ підсвітка коду в **експорті** HTML/PDF (статичний highlighter, напр. highlight.js) — Фаза 5.x
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
- ✅ **Outline**: згортуваний (per-heading + Expand/Collapse All), підсвітка поточного заголовка за кареткою
  - ⬜ popover-варіант аутлайну — за потреби у Фазі 7
- ✅ **Сайдбар**: дві вкладки — **File Tree** і **Articles** (рекурсивний список md, сортування Recent/A–Z, фільтр, relative-time)
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
- ✅ **Автозбереження** (debounce 1.5s → `fs.writeFile`; лише для збереженого файлу, перемикач у меню File + статус-бар; чистий `autoSave` з тестами)
- ✅ **Recover Unsaved Drafts** — debounce-снапшоти у `userData/drafts` поки документ «брудний»; при старті пропонує відновити найновіший стан, що відрізняється від диска (чистий `drafts` з тестами)
- ✅ **Browse All Versions** — локальна історія версій документа: снапшот на кожне збереження (дедуп ідентичних, кап 50) у `userData/versions/<id>`; пікер File → Browse All Versions… з прев'ю й Restore (чисті `shared/versions` з тестами)
- ✅ **Open Recent** (File → Open Recent, пікер) + **Reopen Closed File** (`Ctrl+Shift+T`) — список у localStorage, чистий `recentFiles` з тестами
  - ⬜ **Recent Locations** (нещодавні теки), **Save All**, **New Window** — потребують мульти-вікно (Фаза 9)
- ✅ **Вкладки відкритих файлів** (мульти-док): завжди видимий таб-бар, dirty-індикатор + × на кожній; **повний стан на вкладку** (вміст + undo-історія + курсор/скрол через `Map<id, EditorState>`); відкриття додає вкладку (без guard), guard переїхав на закриття вкладки/вікна; File → Close закриває активну. Чистий `tabsModel` + tab-екшени стора + інтеграційний тест свопу станів
- ✅ **Close / Close Folder** (File): Close закриває активну вкладку (остання → Welcome); Close Folder — усі вкладки + тека → Welcome (guard по кожній брудній вкладці)
- ✅ **Відновлення сесії** (останній документ + тека при старті через localStorage)
  - ✅ **відновлення позиції каретки** при reopen — per-file офсет у localStorage (кап 200), зберігається debounce на зміну виділення, відновлюється при відкритті файлу/сесії (чистий `getCaret/setCaret` + інтеграційний тест)
- ✅ Дії над файлами в дереві (контекст-меню): New File/Folder, Rename, Duplicate, Delete (у кошик ОС), Reveal in File Manager; in-app prompt для імен, авто-оновлення дерева
  - ✅ **Move To** (контекст-меню дерева): folder-picker → `fs.rename` з unique-name й захистом від переміщення в підтеку себе; оновлює відкриті вкладки (`updateTabPath`, ним же тепер користується Rename)
- ✅ **Line Endings** CRLF/LF (меню File) + **Insert Final Newline on Save** — чистий `saveOptions` (нормалізація при записі), з тестами
  - ⬜ Reopen with Encoding (не-UTF-8) — рідко потрібне, додамо за запитом
- ✅ **Стеження за змінами файлу на диску** + перезавантаження/конфлікт: `fs.watch` у main (ігнорує власні записи через `lastWritten`); чистий буфер тихо перезавантажується, «брудний» — питає Reload/Keep Mine; видалення файлу робить буфер «брудним» (чистий `externalChangeAction` з тестами)

## Фаза 5 — експорт і друк
> **Фундамент (5.1):** рушій `doc → standalone HTML` (`exportRender.ts`: markdown-it
> + плагіни footnote/task-lists/sub/sup/mark/texmath-KaTeX + власні rules emoji/
> alerts/`[toc]`/mermaid→SVG + вбудовування зображень у data-URI + DOMPurify),
> світла `export.css`. Реюзають усі виходи нижче.
- ✅ **Export HTML** (with styles / without styles) — меню File → Export ▸; самодостатній HTML
- ✅ **Export PDF** (`printToPDF` в offscreen-вікні) + **Page Setup** (папір A4/Letter/A5/Custom, поля, орієнтація, розрив на H1 — модалка + стан у сторі) + **Print** (системний діалог). Чисті `pageSetup`/`exportRender` з тестами; PDF-пайплайн перевірено наживо
- ✅ **Copy as** (Edit → Copy As): **Markdown** / **HTML** (формат у Word/Docs) / **Plain Text** (`renderPlainText`) / **Image** (PNG у буфер) — через системний clipboard
- ✅ **Export Image** (PNG): повний-сторінковий PNG через offscreen-вікно + `capturePage` (вся висота документа, з DPI-масштабом); File → Export ▸ Image. Спільний `renderToImage` для експорту й Copy as Image
- ✅ **Export через pandoc**: Word (.docx) / OpenDocument (.odt) / RTF / EPUB / LaTeX — детект pandoc (повідомлення «встанови з pandoc.org», якщо немає); читає md-джерело `gfm+tex_math_dollars`, `--resource-path` для зображень. *(саму конвертацію не тестовано наживо — pandoc не встановлено на машині)*
- ⬜ Налаштування експорту по форматах (CSS-тема, вбудовування ресурсів) — 5.5
- ⬜ підсвітка коду в експорті (highlight.js)

## Фаза 6 — теми й оформлення
- ✅ Світла/темна тема (CSS-змінні + перемикач)
- 🟡 Кастомні теми: механізм `[data-theme]` є; треба **завантаження зовнішніх `.css`** із теки тем + перемикач у UI
- ⬜ Кілька **вбудованих тем** (аналоги github / newsprint / night / pixyll / whitey)
- ⬜ Каскад `base.user.css` + `{theme}.user.css` для правок без втрати при оновленні (як у Typora)
- ⬜ **Налаштування**: шрифти (standard/serif/sans/mono), ширина «сторінки», міжрядковий інтервал, розмір; auto-hide menu bar
- ⬜ Повноцінна панель **Preferences** (Editor / Appearance / Image / Markdown-прапорці / Export)

## Фаза 7 — продуктивність і power-user
- ✅ **Панель інструментів для новачків** ⭐: фіксований toolbar + спливаюча над виділенням + меню **Format** + **emoji-пікер** (перемикач `Ctrl/⌘+Shift+B`); набір розширюється з кожною новою фічею
- ⬜ **Команда-палітра** (`Ctrl/⌘ K`/`P`) — усі дії + fuzzy-перемикач файлів ⭐
- ⬜ **Smart Punctuation** (типографські лапки/тире/трикрапка; convert on input/rendering; remap unicode) — за прапорцем
- ⬜ **Перевірка орфографії + граматики** (hunspell), check-while-typing, autocorrect, Learn/Unlearn Word
- ⬜ **Кастомні гарячі клавіші** (`keyBinding`) і **кастомні Search Services** (контекст-меню «Search With…»)
- ⬜ **Мультикурсор** (від CodeMirror — увімкнути й задокументувати)
- ⬜ **TTS** (Start/Stop Speaking), **Clear Format**, **Prettify Source**
- ⬜ **Сніпети/шаблони** документів

## Фаза 9 — «понад Typora» (наші диференціатори ⭐)
> Вкладки, кілька вікон і історія версій у Typora **вже є** — це паритет (фази 3–4),
> не перевага. Справжні переваги:
- ⬜ **Plugin / extension API** — у Typora немає взагалі
- ⬜ **Wiki-links `[[..]]`** + **зворотні посилання (backlinks)** + **граф нотаток** (Obsidian-стиль)
- ⬜ **Git-статус** у дереві файлів + базові git-дії
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
- ⭐ **Вбудований експортер** (docx/epub/…) — прибрати ручну залежність від pandoc.
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
