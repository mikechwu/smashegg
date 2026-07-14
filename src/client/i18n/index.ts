// Typed i18n runtime (PLAN.md §7). No framework dependency: a plain module
// with a tiny listener set so React components can subscribe and re-render
// when the locale changes.

import zhHant from './locales/zh-Hant.json';
import en from './locales/en.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../config';
import type { Locale } from '../config';

// `keyof typeof zhHant` makes every t() call site-checked at compile time,
// and the parity unit test (tests/unit/i18n.test.ts) enforces that every
// locale JSON has exactly this same key set at runtime.
export type TranslationKey = keyof typeof zhHant;

const translations: Record<Locale, Record<TranslationKey, string>> = {
  'zh-Hant': zhHant,
  en,
};

const STORAGE_KEY = 'locale';

function isLocale(value: string | null): value is Locale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function readStoredLocale(): Locale {
  if (typeof localStorage === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

let currentLocale: Locale = readStoredLocale();

const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage unavailable (e.g. private mode) — locale still switches
    // for the current session, just doesn't persist.
  }
  for (const listener of listeners) listener();
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type TranslationParams = Record<string, string | number>;

/** Translate `key` for the current locale, interpolating `{param}` tokens. */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const template = translations[currentLocale][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    return Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match;
  });
}
