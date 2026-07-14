// Client-wide configuration. PLAN.md §7: DEFAULT_LOCALE is THE one-line
// change required by the brief to change the app's default language.

/** Supported UI locales. Add a new locale by adding a value here plus a
 * matching JSON file in src/client/i18n/locales/. */
export type Locale = 'zh-Hant' | 'en';

/** THE one-line default-locale config (PLAN.md §7). */
export const DEFAULT_LOCALE: Locale = 'zh-Hant';

export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-Hant', 'en'];
