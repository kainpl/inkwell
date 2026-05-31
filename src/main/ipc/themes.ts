import { ipcMain, BrowserWindow, shell, app } from 'electron'
import { promises as fs, watch as fsWatch } from 'fs'
import { dirname, join, resolve } from 'path'
import { IPC, type ExternalTheme, type ThemeCss } from '../../shared/ipc'
import {
  isValidThemeId,
  isThemeFile,
  themeIdFromFile,
  themeIdToLabel,
  parseThemeDark
} from '../../shared/themeFile'

/** Absolute path of the user's themes folder. */
function themesDir(): string {
  return join(app.getPath('userData'), 'themes')
}

const README = `Inkwell themes
==============

Drop a .css file in this folder and it appears in Preferences > Appearance >
Theme. A theme redefines the colour tokens on :root (it is only injected while
active, so :root is safe and rename-proof):

  :root {
    --paper: 255 255 255;   /* page background  ("R G B", used as rgb(var(--x))) */
    --ink: 30 30 30;        /* body text */
    --muted: 110 110 110;
    --faint: 165 165 165;
    --line: 230 230 230;    /* borders */
    --accent: 30 100 200;   /* links, caret, active UI */
    --chrome: 246 246 246;  /* sidebars / bars */
    --syn-keyword: 200 40 50;   /* fenced-code syntax colours */
    --syn-string: 30 130 60;
    --syn-number: 10 90 180;
    --syn-literal: 10 90 180;
    --syn-name: 130 80 200;
    --syn-type: 150 60 0;
  }

Mark a theme as dark (so the title-bar icon and diagrams follow) by adding the
marker  inkwell: dark  in a comment near the top of the file.

User overrides (cascade over any theme, like Typora):
  base.user.css        - always applied, on top of the active theme
  <theme-id>.user.css  - applied only when that theme is active

Files are reloaded automatically when you save them.
`

const EXAMPLE = `/* Example theme — copy this file, rename it, and tweak the tokens.
   (To make a dark theme, see the marker note in README.txt.) */
:root {
  --paper: 253 246 227;
  --ink: 88 110 117;
  --muted: 101 123 131;
  --faint: 147 161 161;
  --line: 238 232 213;
  --accent: 38 139 210;
  --chrome: 238 232 213;
  --syn-keyword: 133 153 0;
  --syn-string: 42 161 152;
  --syn-number: 211 54 130;
  --syn-literal: 211 54 130;
  --syn-name: 38 139 210;
  --syn-type: 181 137 0;
}
`

/** Create the themes folder (with a README + example) if it doesn't exist. */
async function ensureThemesDir(): Promise<string> {
  const dir = themesDir()
  try {
    await fs.mkdir(dir, { recursive: true })
    // Seed the README/example only on a fresh folder (don't clobber edits).
    await fs.writeFile(join(dir, 'README.txt'), README, { flag: 'wx' }).catch(() => {})
    await fs.writeFile(join(dir, 'example.css'), EXAMPLE, { flag: 'wx' }).catch(() => {})
  } catch {
    /* non-fatal */
  }
  return dir
}

/** Resolve a theme-relative file, refusing anything outside the themes folder. */
function safeThemePath(dir: string, file: string): string | null {
  const full = resolve(dir, file)
  return dirname(full) === resolve(dir) ? full : null
}

async function readIfPresent(path: string | null): Promise<string | null> {
  if (!path) return null
  try {
    return await fs.readFile(path, 'utf8')
  } catch {
    return null
  }
}

export function registerThemeIpc(): void {
  void ensureThemesDir()

  ipcMain.handle(IPC.listThemes, async (): Promise<ExternalTheme[]> => {
    const dir = await ensureThemesDir()
    let names: string[]
    try {
      names = await fs.readdir(dir)
    } catch {
      return []
    }
    const themes: ExternalTheme[] = []
    for (const name of names) {
      if (!isThemeFile(name)) continue
      const id = themeIdFromFile(name)
      if (!isValidThemeId(id)) continue
      const css = (await readIfPresent(join(dir, name))) ?? ''
      themes.push({ id, label: themeIdToLabel(id), dark: parseThemeDark(css) })
    }
    themes.sort((a, b) => a.label.localeCompare(b.label))
    return themes
  })

  ipcMain.handle(IPC.readThemeCss, async (_e, id: string): Promise<ThemeCss> => {
    const empty: ThemeCss = { theme: null, base: null, themeUser: null }
    if (!isValidThemeId(id)) return empty
    const dir = await ensureThemesDir()
    return {
      theme: await readIfPresent(safeThemePath(dir, `${id}.css`)),
      base: await readIfPresent(safeThemePath(dir, 'base.user.css')),
      themeUser: await readIfPresent(safeThemePath(dir, `${id}.user.css`))
    }
  })

  ipcMain.handle(IPC.openThemesFolder, async (): Promise<void> => {
    const dir = await ensureThemesDir()
    await shell.openPath(dir)
  })

  // Watch the folder so edits hot-reload in the renderer (debounced).
  void ensureThemesDir().then((dir) => {
    try {
      let timer: NodeJS.Timeout | null = null
      fsWatch(dir, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          for (const w of BrowserWindow.getAllWindows()) {
            w.webContents.send(IPC.themesChanged)
          }
        }, 200)
      })
    } catch {
      /* watching is best-effort */
    }
  })
}
