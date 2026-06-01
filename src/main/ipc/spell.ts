import { ipcMain, BrowserWindow, net, app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { IPC, type SpellDict } from '../../shared/ipc'

/**
 * Spell-check dictionaries for languages other than the bundled English. Each
 * language's hunspell `.aff`/`.dic` is downloaded once from the `wooorm/
 * dictionaries` tree (the renderer's CSP can't fetch GitHub) and cached under
 * `userData/dictionaries/<lang>/`.
 */

const BASE = 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries'

function dictDir(lang: string): string {
  return join(app.getPath('userData'), 'dictionaries', lang)
}

/** Lang ids are short codes from a fixed list — reject anything path-unsafe. */
function isValidLang(lang: string): boolean {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(lang)
}

async function readCached(dir: string): Promise<SpellDict | null> {
  try {
    const [aff, dic] = await Promise.all([
      fs.readFile(join(dir, 'index.aff'), 'utf8'),
      fs.readFile(join(dir, 'index.dic'), 'utf8')
    ])
    return { aff, dic }
  } catch {
    return null
  }
}

/** The bundled English dictionary (read straight from the dictionary-en package). */
async function bundledEnglish(): Promise<SpellDict> {
  const dir = join(app.getAppPath(), 'node_modules', 'dictionary-en')
  try {
    const [aff, dic] = await Promise.all([
      fs.readFile(join(dir, 'index.aff'), 'utf8'),
      fs.readFile(join(dir, 'index.dic'), 'utf8')
    ])
    return { aff, dic }
  } catch {
    return { aff: '', dic: '' }
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await net.fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return await res.text()
}

function report(pct: number): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.spellProgress, pct)
}

export function registerSpellIpc(): void {
  ipcMain.handle(IPC.getSpellDict, async (_e, lang: string): Promise<SpellDict> => {
    const empty: SpellDict = { aff: '', dic: '' }
    if (!isValidLang(lang)) return empty
    if (lang === 'en') return bundledEnglish() // bundled, no download
    const dir = dictDir(lang)

    const cached = await readCached(dir)
    if (cached) return cached

    try {
      report(5)
      const aff = await fetchText(`${BASE}/${lang}/index.aff`)
      report(40)
      const dic = await fetchText(`${BASE}/${lang}/index.dic`)
      report(90)
      await fs.mkdir(dir, { recursive: true })
      await Promise.all([
        fs.writeFile(join(dir, 'index.aff'), aff),
        fs.writeFile(join(dir, 'index.dic'), dic)
      ])
      report(-1)
      return { aff, dic }
    } catch {
      report(-1)
      return empty
    }
  })
}
