import { en } from './en'
import { uk } from './uk'
import { ru } from './ru'

/**
 * Tiny dependency-free i18n shared by the main process (native menu) and the
 * renderer. Dictionaries are flat `key → text` maps with dotted keys; missing
 * keys fall back to English, then to the key itself. `{var}` placeholders are
 * interpolated from `vars`.
 */

export type Locale = 'en' | 'uk' | 'ru'

export const LOCALES: Locale[] = ['en', 'uk', 'ru']

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский'
}

export const DEFAULT_LOCALE: Locale = 'en'

export type Dict = Record<string, string>

const DICTS: Record<Locale, Dict> = { en, uk, ru }

export function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'uk' || v === 'ru'
}

/** Translate `key` for `locale` (English/key fallback), interpolating `{var}`s. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const s = DICTS[locale]?.[key] ?? DICTS.en[key] ?? key
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))
}
