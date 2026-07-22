// The suit registry (suit round): the owner's four SVG paths are the SINGLE
// SOURCE OF TRUTH for suit shapes, and NO rendered surface may contain a
// Unicode suit character — the leftover-glyph failure is exactly the bug
// this round fixes (a font suit char renders as a COLOR EMOJI on some
// Chinese-brand Android builds; desktop and iPhone render it fine, so only
// a structural scan catches a stray). The ratchet, DOM-free per the suite's
// idiom (static renders + source scans):
//  • the no-suit-codepoint scan over EVERY file in src/client (comments
//    included — total by construction, nothing to remember);
//  • the registry's shape contract (four suits, single-path, currentColor,
//    no baked color — the DeckTheme recolor path);
//  • every consumer draws through the registry: lacquer index + body pip,
//    GhostFace, cinnabar-court corner/pips/court-cartouche, the chooser and
//    desk SF run labels (SuitMark visually, the localized suit WORD in
//    aria).
// What stays eyes-gated: family coherence and ~12px legibility at true
// 390px, and the Android emoji-render itself (an M5 real-device check — no
// desktop environment can confirm it; the scan here removes the CAUSE).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { SUIT_PATHS, SUIT_VIEWBOX, SuitMark } from '../../../src/client/table/suits';
import * as helpers from '../../../src/client/table/helpers';
import { comboDeclNode, GhostFace } from '../../../src/client/table/CardFace';
import { LACQUER_THEME } from '../../../src/client/table/themes/lacquer';
import { CINNABAR_COURT_THEME } from '../../../src/client/table/themes/cinnabar-court';
import { getLocale, setLocale } from '../../../src/client/i18n';
import { tNode } from '../../../src/client/i18n/react';
import { SUITS } from '../../../src/engine/guandan/cards';

const ROOT = join(__dirname, '../../../');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// ---------------------------------------------------------------------------
// The structural pin: zero suit codepoints anywhere under src/client.
// ---------------------------------------------------------------------------

// U+2660..2667 covers the filled AND white suit forms (banning the base
// character also bans its emoji/text variation-selector sequences); the
// U+1F0A0..1F0FF playing-card block is banned alongside for the same
// emoji-promotion reason. ESCAPED forms are banned too (panel MED, Codex:
// a literal-only scan would miss '♠', '\u{2660}', '&spades;',
// '&#x2660;', '&#9824;' or CSS content: "\2660" — every one puts the same
// glyph on screen). Each pattern is self-tested below so the scan itself
// cannot silently rot.
const SUIT_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'literal suit char / playing-card emoji', re: /[♠-♧\u{1F0A0}-\u{1F0FF}]/u },
  // JS '♠' / '\u{2660}' and CSS "\2660" hex escapes (optional space)
  { name: 'escaped suit codepoint', re: /\\u?\{?266[0-7]\}?/i },
  // JS surrogate-pair / braced escapes and CSS hex for U+1F0A0..1F0FF
  { name: 'escaped playing-card codepoint', re: /\\u\{?1F0[0-9A-F]{2}\}?|\\uD83C\\uDC[0-9A-F]{2}/i },
  { name: 'named suit entity', re: /&(spades|hearts|diams|clubs);/i },
  { name: 'numeric suit entity', re: /&#x266[0-7];|&#98(2[4-9]|3[01]);|&#x1F0[0-9A-F]{2};/i },
  // panel MED (Grok): computed construction evades a text scan — ban the
  // codepoint arguments themselves (hex or decimal suit/card ranges).
  {
    name: 'fromCharCode/fromCodePoint suit construction',
    re: /fromC(?:harCode|odePoint)\([^)]*(?:0x266[0-7]|0x1F0[0-9A-F]{2}|98(?:2[4-9]|3[01])|1271[0-9]{2})/i,
  },
  // heart stand-ins a well-meaning edit might reach for (same emoji
  // promotion on the same devices): U+2763/2764.
  { name: 'heart dingbat stand-in', re: /[❣❤]|\\u?\{?276[34]\}?|&#x276[34];|&#1003[89];/i },
];

describe('no Unicode suit codepoint in any client file (the Android emoji bug, removed structurally)', () => {
  it('scans EVERY file under src/client — comments and strings included, escapes and entities too', () => {
    const offenders: string[] = [];
    for (const entry of readdirSync(join(ROOT, 'src/client'), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      const path = join(entry.parentPath, entry.name);
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { name, re } of SUIT_PATTERNS) {
          if (re.test(line)) offenders.push(`${relative(ROOT, path)}:${i + 1} (${name})`);
        }
      });
    }
    expect(offenders, `suit codepoints found:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the scan patterns catch every known smuggling form (self-test)', () => {
    const smuggled: [string, string][] = [
      ['literal char', 'const x = "♠"'],
      ['white form', 'const x = "♡"'],
      ['card emoji', 'const x = "\u{1F0A1}"'],
      ['JS hex escape', String.raw`const x = '\u2660'`],
      ['JS braced escape', String.raw`const x = '\u{2665}'`],
      ['CSS content escape', String.raw`content: "\2663"`],
      ['JS surrogate pair', String.raw`const x = '\uD83C\uDCA1'`],
      ['braced card escape', String.raw`const x = '\u{1F0A1}'`],
      ['named entity', '<span>&spades;</span>'],
      ['hex entity', '<span>&#x2660;</span>'],
      ['decimal entity', '<span>&#9824;</span>'],
      ['card hex entity', '<span>&#x1F0A1;</span>'],
      ['fromCharCode hex', 'String.fromCharCode(0x2660)'],
      ['fromCodePoint decimal', 'String.fromCodePoint(9824)'],
      ['fromCodePoint card', 'String.fromCodePoint(0x1F0A1)'],
      ['heart dingbat', 'const x = "❤"'],
    ];
    for (const [form, sample] of smuggled) {
      expect(
        SUIT_PATTERNS.some(({ re }) => re.test(sample)),
        `${form} not caught: ${sample}`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The registry contract.
// ---------------------------------------------------------------------------

describe('suit registry (suits.tsx) — the single source of suit shapes', () => {
  it('holds exactly the four suits as single-subpath, absolute-command paths', () => {
    expect(Object.keys(SUIT_PATHS).sort()).toEqual([...SUITS].sort());
    for (const suit of SUITS) {
      const d = SUIT_PATHS[suit];
      // one M = one subpath (the owner constraint: single-path, no defs)
      expect(d.match(/[Mm]/g), `${suit}: single subpath`).toHaveLength(1);
      expect(d, `${suit}: closes`).toMatch(/Z\s*$/);
      expect(d, `${suit}: absolute commands only`).not.toMatch(/[a-y]/);
    }
    expect(SUIT_VIEWBOX).toBe('0 0 100 100');
  });

  it('SuitMark fills with currentColor and the module bakes in no color (the DeckTheme recolor path)', () => {
    const html = renderToStaticMarkup(createElement(SuitMark, { suit: 'S' }));
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain(`viewBox="${SUIT_VIEWBOX}"`);
    expect(html).toContain('aria-hidden="true"');
    const src = read('src/client/table/suits.tsx');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toContain('var(--');
  });

  it('SuitMark with a label is an img with an accessible name (text surfaces)', () => {
    const html = renderToStaticMarkup(createElement(SuitMark, { suit: 'H', label: 'Hearts' }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Hearts"');
    expect(html).not.toContain('aria-hidden');
  });

  it('the old font-glyph helper is GONE (no second way to draw a suit)', () => {
    expect((helpers as Record<string, unknown>).suitGlyph).toBeUndefined();
  });

  // panel MED (Grok): the export check above would not notice a LOCAL
  // suitGlyph reappearing in some component — ban the identifier and any
  // suit-path map definition outside the registry across all of src/client.
  // Honest boundary: a copied path under a fresh name evades any static
  // scan — that residual is review's and the eyes-gate's to catch.
  it('no suitGlyph identifier and no suit-path map defined outside suits.tsx', () => {
    const offenders: string[] = [];
    for (const entry of readdirSync(join(ROOT, 'src/client'), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      const path = join(entry.parentPath, entry.name);
      const rel = relative(ROOT, path);
      const src = readFileSync(path, 'utf8');
      if (/\bsuitGlyph\b|\bSUIT_GLYPHS\b/.test(src)) offenders.push(`${rel}: suitGlyph identifier`);
      if (rel !== join('src/client/table', 'suits.tsx') && /SUIT_PATHS\s*[:=]\s*\{/.test(src))
        offenders.push(`${rel}: local SUIT_PATHS definition`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Consumers draw through the registry.
// ---------------------------------------------------------------------------

describe('every suit render site consumes the registry', () => {
  it('lacquer hand face: registry path twice (corner index + body pip), pip is the shared part', () => {
    const html = renderToStaticMarkup(
      createElement(LACQUER_THEME.Face, { card: '9S', level: '2', size: 'hand' }),
    );
    expect(html.split(SUIT_PATHS.S).length - 1).toBe(2);
    expect(html).toContain('gd-suit gd-card__pip');
  });

  it('GhostFace with a suit draws the registry path; suit-blind draws none', () => {
    const suited = renderToStaticMarkup(createElement(GhostFace, { rank: '9', suit: 'H', size: 'hand' }));
    expect(suited.split(SUIT_PATHS.H).length - 1).toBe(1);
    const blind = renderToStaticMarkup(createElement(GhostFace, { rank: '9', suit: null, size: 'hand' }));
    for (const suit of SUITS) expect(blind).not.toContain(SUIT_PATHS[suit]);
  });

  it('cinnabar-court court face: registry path in the corner AND the center cartouche', () => {
    const html = renderToStaticMarkup(
      createElement(CINNABAR_COURT_THEME.Face, { card: 'KD', level: '2', size: 'hand' }),
    );
    // corner index + the double-ended CourtFigure's single center cartouche
    expect(html.split(SUIT_PATHS.D).length - 1).toBe(2);
  });

  it('art.tsx carries NO suit path of its own — it imports the registry', () => {
    const src = read('src/client/table/themes/cinnabar-court/art.tsx');
    expect(src).toMatch(/import \{ SUIT_PATHS \} from '\.\.\/\.\.\/suits'/);
    expect(src).not.toContain('SUIT_GLYPH_VIEWBOX');
    // no path literal assigned to a suit map outside the registry
    expect(src).not.toMatch(/SUIT_PATHS\s*[:=]\s*\{/);
  });

  it('the desk/chooser SF label: SuitMark visually, the localized suit WORD in aria', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const html = renderToStaticMarkup(
        createElement(
          'span',
          null,
          comboDeclNode({ type: 'straightFlush', size: 5, keyRank: '9', suit: 'S' } as never),
        ),
      );
      expect(html).toContain('5–9');
      expect(html.split(SUIT_PATHS.S).length - 1).toBe(1);
      expect(html).toContain('aria-label="Spades"');
    } finally {
      setLocale(original);
    }
  });
});

// ---------------------------------------------------------------------------
// The rich-interpolation seam (i18n/react.tsx) the desk status rides.
// ---------------------------------------------------------------------------

describe('tNode — t() with ReactNode params', () => {
  let original: ReturnType<typeof getLocale>;
  beforeEach(() => {
    original = getLocale();
    setLocale('en');
  });
  afterEach(() => {
    setLocale(original);
  });

  it('interleaves a node param into the translated template', () => {
    const html = renderToStaticMarkup(
      createElement('span', null, tNode('game.desk.aboutToPlay', { combo: createElement('b', null, 'X') })),
    );
    expect(html).toContain('<b>X</b>');
    expect(html).toContain('About to play');
  });

  it('renders unknown tokens literally (same contract as string t())', () => {
    const html = renderToStaticMarkup(createElement('span', null, tNode('game.desk.aboutToPlay', {})));
    expect(html).toContain('{combo}');
  });
});

// ---------------------------------------------------------------------------
// CSS wiring: the shared part's base rule, and the pip's box metrics.
// ---------------------------------------------------------------------------

describe('suit CSS wiring (table.css)', () => {
  const css = read('src/client/table/table.css');

  it('.gd-suit base rule exists and em-sizes the part', () => {
    expect(css).toMatch(/\.gd-suit\s*\{[^}]*width:\s*0\.84em/);
  });

  it('.gd-card__pip is a --gd-cardw BOX now, not a font glyph (the migration must not regress)', () => {
    const rule = css.match(/\.gd-card__pip\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/width:\s*calc\(var\(--gd-cardw\)/);
    expect(rule).not.toContain('font-size');
    expect(rule).not.toContain('font-family');
  });

  it('.gd-ccourt__suitGlyph is a square --gd-cardw box (the registry viewBox is square)', () => {
    const rule = css.match(/\.gd-ccourt__suitGlyph\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/width:\s*calc\(var\(--gd-cardw\)\s*\*\s*0\.38\)/);
    expect(rule).toMatch(/height:\s*calc\(var\(--gd-cardw\)\s*\*\s*0\.38\)/);
  });
});
