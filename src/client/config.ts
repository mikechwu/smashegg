// Client-wide configuration. PLAN.md §7: DEFAULT_LOCALE is THE one-line
// change required by the brief to change the app's default language.

/** Supported UI locales. Add a new locale by adding a value here plus a
 * matching JSON file in src/client/i18n/locales/. */
export type Locale = 'zh-Hant' | 'zh-Hans' | 'en';

/** FALLBACK locale, used when the browser reports nothing detectLocale()
 * recognizes (or navigator is unavailable, e.g. under Node test runners).
 * No longer THE default in a browser — detectLocale() below picks that.
 * The client's actual resolution chain (i18n/index.ts readStoredLocale) is
 * saved choice > detectLocale() > DEFAULT_LOCALE — there is no separate
 * "en" fallback leg after DEFAULT_LOCALE: DEFAULT_LOCALE (zh-Hant) already
 * IS the tail of the chain, and the three locales are kept in full parity
 * (tests/unit/i18n.test.ts), so an extra en leg would add complexity
 * without adding coverage (m4). */
export const DEFAULT_LOCALE: Locale = 'zh-Hant';

export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-Hant', 'zh-Hans', 'en'];

// Ordered browser-tag → Locale mapping, most specific first. A tag matches
// an entry when it equals the entry's tag or starts with it followed by
// "-" (so "zh-Hant-TW" matches "zh-Hant", "zh-CN" matches exactly, etc).
// Matching is case-insensitive. Bare "zh" (no script/region) maps to
// zh-Hans, matching the majority of bare-"zh" browser configurations.
const LOCALE_TAG_MAP: readonly { tag: string; locale: Locale }[] = [
  { tag: 'zh-tw', locale: 'zh-Hant' },
  { tag: 'zh-hk', locale: 'zh-Hant' },
  { tag: 'zh-mo', locale: 'zh-Hant' }, // Macau — traditional script (m2/m3)
  { tag: 'zh-hant', locale: 'zh-Hant' },
  { tag: 'zh-cn', locale: 'zh-Hans' },
  { tag: 'zh-sg', locale: 'zh-Hans' },
  { tag: 'zh-hans', locale: 'zh-Hans' },
  { tag: 'zh', locale: 'zh-Hans' },
  { tag: 'en', locale: 'en' },
];

function matchTag(lowerTag: string): Locale | undefined {
  for (const { tag, locale } of LOCALE_TAG_MAP) {
    if (lowerTag === tag || lowerTag.startsWith(`${tag}-`)) return locale;
  }
  return undefined;
}

/** Detect the best-fit locale from the browser's navigator.languages, in
 * preference order; the first language tag that maps to a supported
 * locale wins. When navigator.languages is empty/undefined (some browsers
 * only populate the singular navigator.language, m2/m3), that single tag
 * is consulted too. Falls back to DEFAULT_LOCALE (zh-Hant) when navigator
 * is unavailable (e.g. Node-based unit tests) or nothing matches. A manual
 * choice saved to localStorage always overrides this — see i18n/index.ts. */
export function detectLocale(): Locale {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const languages =
    nav !== undefined && Array.isArray(nav.languages) && nav.languages.length > 0
      ? nav.languages
      : nav?.language !== undefined
        ? [nav.language]
        : [];
  for (const tag of languages) {
    const match = matchTag(tag.toLowerCase());
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

/** The game the home page's create-room form creates. The MVP ships one
 * game, so this is a constant rather than a picker — but the id lives here,
 * not hardcoded at the call site, so adding a picker later is a UI change
 * only (PLAN.md §4: the room layer treats gameId/config as opaque). */
export const DEFAULT_GAME_ID = 'guandan';
