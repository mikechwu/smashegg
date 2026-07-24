// STANDING design-system guard (visual-refinement round). Two structural rules
// — made structural, not remembered, the same instinct as the no-CJK-in-code
// lint — plus the loudness hierarchy pinned by COMPUTED value:
//
//  1. Palette COLOURS may appear as raw hex ONLY in the token definitions.
//     The rule/timing pickers had drifted off-system with duplicated
//     #4A2C27/#F5EFE3/#C3392B; this stops any component or rule re-writing a
//     palette colour instead of referencing its token.
//  2. Every UI font-size rides the type SCALE (var(--fs-*)) — never a raw
//     rem/px literal. The pickers had 0.95/0.8/1.1rem one-offs invisible to the
//     stylesheets; this stops off-scale sizes reappearing.
//  3. The loudness hierarchy holds by value: the own-turn desk clock is the
//     largest desk element; the low-card count escalates; victory > banner >
//     line. Adjusting type sizes is THIS round's job, so the hierarchy is
//     exactly what a polish pass can silently flatten — pin the computed rem.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveScale } from './css-tokens';

const CLIENT = join(__dirname, '../../../src/client');
const read = (rel: string) => readFileSync(join(CLIENT, rel), 'utf8');
const appCss = read('app.css');
const tableCss = read('table/table.css');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}
const ALL = walk(CLIENT);
const rel = (p: string) => p.slice(CLIENT.length + 1);
// Deck/figure ART renders its own palette (frozen art modules, the swappable
// art pools) — legitimately colour-literal, exempt from the token rule.
const ART = (p: string) => /(^|\/)themes\//.test(rel(p)) || /(^|\/)art-pool\//.test(rel(p));

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

const PALETTE = [
  '#2b1a18', '#4a2c27', '#f5efe3', '#c3392b', '#1f2430', '#c9a227',
  '#faf2e1', '#1f4d3a', '#2c6a50', '#e37628',
];

describe('design-system guard — palette colours live only in token definitions', () => {
  it('no CSS rule re-writes a palette colour as raw hex (token defs + data-URIs excepted)', () => {
    for (const css of [appCss, tableCss]) {
      const scannable = stripComments(css)
        .split('\n')
        // token definitions: `  --name: #hex;`
        .filter((l) => !/^\s*--[\w-]+:\s*#[0-9a-fA-F]{3,8}\b/.test(l))
        // data-URI SVGs cannot reference a CSS var — colour must be literal there
        .filter((l) => !/data:image\/svg/.test(l))
        .join('\n');
      for (const hex of PALETTE) {
        expect(
          scannable.toLowerCase().includes(hex),
          `palette ${hex} appears outside the token definitions — reference its token, do not re-write the hex`,
        ).toBe(false);
      }
    }
  });

  it('no component (.tsx) hardcodes a palette colour outside deck/figure art', () => {
    const offenders: string[] = [];
    for (const p of ALL) {
      if (!p.endsWith('.tsx') && !p.endsWith('.ts')) continue;
      if (ART(p)) continue;
      const src = stripComments(readFileSync(p, 'utf8')).toLowerCase();
      for (const hex of PALETTE) if (src.includes(hex)) offenders.push(`${rel(p)} :: ${hex}`);
    }
    expect(offenders, `components must use palette tokens, not raw hex:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('design-system guard — every font-size rides the type scale', () => {
  // Allowed forms: a scale token, a card-metric calc, a parent-relative em, or a
  // keyword. A bare rem/px literal is an off-scale one-off (the pickers' sin).
  const okValue = (v: string) =>
    /^var\(--fs-/.test(v) ||
    /^calc\(\s*var\(--gd-cardw/.test(v) ||
    /^clamp\(/.test(v) || // responsive display sizing (the room-code numeral)
    /^[\d.]+em$/.test(v) ||
    /^(inherit|initial|unset)$/.test(v);

  it('CSS + components use var(--fs-*) / card-metric / em — never a raw rem/px font-size', () => {
    const offenders: string[] = [];
    for (const p of ALL) {
      const src = stripComments(readFileSync(p, 'utf8'));
      for (const m of src.matchAll(/font-size:\s*([^;}\n]+)/g)) {
        const v = m[1]!.trim();
        if (!okValue(v)) offenders.push(`${rel(p)} :: font-size: ${v}`);
      }
    }
    expect(offenders, `off-scale font sizes (tokenize them):\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('loudness hierarchy — pinned by COMPUTED size, not token name', () => {
  const remOf = (css: string, selector: string): number => {
    const esc = selector.replace(/[.\\-]/g, '\\$&');
    // Match any rule whose SELECTOR LIST contains this selector as a whole token
    // (so `.a, .b { font-size }` is found for either .a or .b) and that declares
    // a font-size. LAST match wins: a base rule may be overridden by a later
    // standalone rule (e.g. .gd-result__headline 1.25rem -> 1.75rem). The
    // boundaries keep `.gd-seatcount` from matching `.gd-seatcount--critical`.
    const re = new RegExp(`(?<![\\w-])${esc}(?![\\w-])[^{}]*\\{[^}]*?font-size:\\s*([\\d.]+)rem`, 'g');
    const all = [...resolveScale(css, appCss).matchAll(re)];
    expect(all.length, `font-size not found for ${selector}`).toBeGreaterThan(0);
    return Number(all[all.length - 1]![1]);
  };

  it('the own-turn desk clock is the LOUDEST desk element (> title > status)', () => {
    const clock = remOf(tableCss, '.gd-desk__clock');
    const title = remOf(tableCss, '.gd-desk__title');
    const status = remOf(tableCss, '.gd-desk__status');
    expect(clock).toBeGreaterThan(title);
    expect(title).toBeGreaterThanOrEqual(status);
  });

  it('the desk clock (primary own-turn clock) is larger than the headline clock echo', () => {
    expect(remOf(tableCss, '.gd-desk__clock')).toBeGreaterThan(remOf(tableCss, '.gd-headline__clockNum'));
  });

  it('the low-card count escalates: critical is LARGER than the normal count', () => {
    expect(remOf(tableCss, '.gd-seatcount--critical')).toBeGreaterThan(remOf(tableCss, '.gd-seatcount'));
  });

  it('the end-of-hand chain reads victory > banner > line', () => {
    const victory = remOf(tableCss, '.gd-result__headline');
    const banner = remOf(tableCss, '.gd-ceremony__banner');
    const line = remOf(tableCss, '.gd-ceremony__line');
    expect(victory).toBeGreaterThan(banner);
    expect(banner).toBeGreaterThan(line);
  });
});
