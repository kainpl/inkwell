/**
 * Renderer-side i18n: a reactive `useT()` hook for components and a non-reactive
 * `t()` for event handlers / non-component code. Both read the active `locale`
 * from the store and delegate to the shared `translate()` (English/key fallback).
 */

import { useAppStore } from '@renderer/store/useAppStore'
import { translate } from '@shared/i18n'

export type TFn = (key: string, vars?: Record<string, string | number>) => string

/** Reactive translator — components re-render when the locale changes. */
export function useT(): TFn {
  const locale = useAppStore((s) => s.locale)
  return (key, vars) => translate(locale, key, vars)
}

/** Non-reactive translator for imperative code (reads the current locale once). */
export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(useAppStore.getState().locale, key, vars)
}
