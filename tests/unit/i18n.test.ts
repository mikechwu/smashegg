import { describe, expect, it } from 'vitest';
import zhHant from '../../src/client/i18n/locales/zh-Hant.json';
import zhHans from '../../src/client/i18n/locales/zh-Hans.json';
import en from '../../src/client/i18n/locales/en.json';
import {
  DEFAULT_LOCALE,
  LOCALE_SELF_LABELS,
  SUPPORTED_LOCALES,
  detectLocale,
} from '../../src/client/config';
import { t, setLocale, getLocale } from '../../src/client/i18n';

// Recursively collect the sorted key set of a (possibly nested) object.
// Locale files are currently flat, but this keeps the parity check correct
// if a locale file is ever nested.
function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n locale parity', () => {
  it('zh-Hant, zh-Hans and en all have exactly the same key sets', () => {
    const zhHantKeys = collectKeys(zhHant).sort();
    const zhHansKeys = collectKeys(zhHans).sort();
    const enKeys = collectKeys(en).sort();
    expect(zhHansKeys).toEqual(zhHantKeys);
    expect(enKeys).toEqual(zhHantKeys);
  });

  it('every value in every locale is a non-empty string', () => {
    for (const locale of [zhHant, zhHans, en]) {
      for (const [key, value] of Object.entries(locale)) {
        expect(typeof value, `${key} should be a string`).toBe('string');
        expect((value as string).length, `${key} should be non-empty`).toBeGreaterThan(0);
      }
    }
  });
});

describe('i18n config', () => {
  it('DEFAULT_LOCALE is zh-Hant', () => {
    expect(DEFAULT_LOCALE).toBe('zh-Hant');
  });

  // m3h visual finding: the switcher showed 簡體中文 under zh-Hant because
  // language names lived in the locale files as translations. Endonyms are
  // constants — each option labels itself in its own script — so this pins
  // the exact glyphs and that no locale file can reintroduce the drift.
  it('locale switcher labels are endonyms, defined for every supported locale', () => {
    expect(SUPPORTED_LOCALES.map((l) => LOCALE_SELF_LABELS[l])).toEqual([
      '繁體中文',
      '简体中文',
      'English',
    ]);
    for (const locale of [zhHant, zhHans, en]) {
      expect(Object.keys(locale).some((k) => k.startsWith('locale.zh') || k === 'locale.en')).toBe(
        false,
      );
    }
  });
});

describe('detectLocale()', () => {
  const withLanguages = (languages: string[] | undefined, fn: () => void) => {
    const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'languages');
    Object.defineProperty(globalThis.navigator, 'languages', {
      value: languages,
      configurable: true,
    });
    try {
      fn();
    } finally {
      if (original) {
        Object.defineProperty(globalThis.navigator, 'languages', original);
      }
    }
  };

  // m2/m3: navigator.languages AND navigator.language, together, so a
  // browser that only populates the singular field is still detected.
  const withLanguagesAndLanguage = (
    languages: string[] | undefined,
    language: string | undefined,
    fn: () => void,
  ) => {
    const originalLanguages = Object.getOwnPropertyDescriptor(globalThis.navigator, 'languages');
    const originalLanguage = Object.getOwnPropertyDescriptor(globalThis.navigator, 'language');
    Object.defineProperty(globalThis.navigator, 'languages', { value: languages, configurable: true });
    Object.defineProperty(globalThis.navigator, 'language', { value: language, configurable: true });
    try {
      fn();
    } finally {
      if (originalLanguages) Object.defineProperty(globalThis.navigator, 'languages', originalLanguages);
      if (originalLanguage) Object.defineProperty(globalThis.navigator, 'language', originalLanguage);
    }
  };

  it('maps zh-TW and zh-HK to zh-Hant', () => {
    withLanguages(['zh-TW'], () => expect(detectLocale()).toBe('zh-Hant'));
    withLanguages(['zh-HK'], () => expect(detectLocale()).toBe('zh-Hant'));
  });

  it('maps zh-Hant* variants (including region suffixes) to zh-Hant', () => {
    withLanguages(['zh-Hant-TW'], () => expect(detectLocale()).toBe('zh-Hant'));
    withLanguages(['zh-Hant'], () => expect(detectLocale()).toBe('zh-Hant'));
  });

  it('maps zh-CN and zh-SG to zh-Hans', () => {
    withLanguages(['zh-CN'], () => expect(detectLocale()).toBe('zh-Hans'));
    withLanguages(['zh-SG'], () => expect(detectLocale()).toBe('zh-Hans'));
  });

  it('maps zh-Hans* variants to zh-Hans', () => {
    withLanguages(['zh-Hans-CN'], () => expect(detectLocale()).toBe('zh-Hans'));
  });

  it('maps bare "zh" to zh-Hans', () => {
    withLanguages(['zh'], () => expect(detectLocale()).toBe('zh-Hans'));
  });

  it('maps en* variants to en', () => {
    withLanguages(['en-US'], () => expect(detectLocale()).toBe('en'));
    withLanguages(['en'], () => expect(detectLocale()).toBe('en'));
  });

  it('picks the first matching language when several are listed', () => {
    withLanguages(['fr-FR', 'en-US', 'zh-CN'], () => expect(detectLocale()).toBe('en'));
  });

  it('falls back to DEFAULT_LOCALE for unknown/unmatched languages', () => {
    withLanguages(['fr-FR', 'de-DE'], () => expect(detectLocale()).toBe(DEFAULT_LOCALE));
    // An empty navigator.languages now falls through to navigator.language
    // (m2) — neutralize it too, so this pins the "nothing matches at all"
    // case rather than accidentally depending on the test runner's own
    // navigator.language.
    withLanguagesAndLanguage([], 'fr-FR', () => expect(detectLocale()).toBe(DEFAULT_LOCALE));
  });

  it('falls back to DEFAULT_LOCALE when navigator.languages is absent', () => {
    withLanguagesAndLanguage(undefined, 'fr-FR', () => expect(detectLocale()).toBe(DEFAULT_LOCALE));
  });

  // m3: Macau uses traditional script.
  it('maps zh-MO to zh-Hant', () => {
    withLanguages(['zh-MO'], () => expect(detectLocale()).toBe('zh-Hant'));
  });

  // m2: some browsers only populate the singular navigator.language, not
  // navigator.languages — detectLocale must still find it.
  describe('navigator.language fallback (m2)', () => {
    it('consults navigator.language when navigator.languages is undefined', () => {
      withLanguagesAndLanguage(undefined, 'zh-TW', () => expect(detectLocale()).toBe('zh-Hant'));
    });

    it('consults navigator.language when navigator.languages is empty', () => {
      withLanguagesAndLanguage([], 'zh-CN', () => expect(detectLocale()).toBe('zh-Hans'));
    });

    it('prefers navigator.languages over navigator.language when both are present', () => {
      withLanguagesAndLanguage(['en-US'], 'zh-CN', () => expect(detectLocale()).toBe('en'));
    });

    it('falls back to DEFAULT_LOCALE when both are empty/unmatched', () => {
      withLanguagesAndLanguage([], 'fr-FR', () => expect(detectLocale()).toBe(DEFAULT_LOCALE));
      withLanguagesAndLanguage(undefined, undefined, () => expect(detectLocale()).toBe(DEFAULT_LOCALE));
    });
  });
});

describe('t()', () => {
  it('interpolates {params} into the template', () => {
    const original = getLocale();
    setLocale('en');
    expect(t('hello.count', { count: 3 })).toBe('Call count: 3');
    expect(t('hello.alarmFired', { seconds: 12 })).toBe('Alarm fired, took 12 seconds');
    setLocale(original);
  });

  it('returns the template unchanged when no params are given', () => {
    const original = getLocale();
    setLocale('en');
    expect(t('hello.heading')).toBe('Connectivity check');
    setLocale(original);
  });
});
