import { describe, expect, it } from 'vitest';
import zhHant from '../../src/client/i18n/locales/zh-Hant.json';
import en from '../../src/client/i18n/locales/en.json';
import { DEFAULT_LOCALE } from '../../src/client/config';
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
  it('zh-Hant and en have exactly the same key sets', () => {
    const zhKeys = collectKeys(zhHant).sort();
    const enKeys = collectKeys(en).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it('every value in every locale is a non-empty string', () => {
    for (const locale of [zhHant, en]) {
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
