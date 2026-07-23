// Cinnabar Court — the hand-drawn court pieces (3 court figures x 4 suits
// by emblem + palette), drawn in the app's Eastern-minimalist idiom. The
// theme's jokers moved to the shared registry (jokers.tsx, joker round).
// Geometry is the master record: it passed the craft gate at ship sizes
// (docs/design/deck-themes/cinnabar-court/DESIGN.md §5) — edits here must
// re-clear that gate, not just look right at inspection size.
//
// Card space is 200x290 (aspect 1.45). Courts are double-ended: one bust
// mirrored by rotate(180 136 145) — about the FIGURE column's center
// (x∈[76,196]), not the card's, so both halves stay clear of the top-left
// identity column. Everything paints with the table palette tokens only.

import type { ReactElement } from 'react';
import { SUIT_PATHS } from '../../suits';

export type SuitChar = 'S' | 'H' | 'D' | 'C';
export type CourtChar = 'K' | 'Q' | 'J';

const IVORY = 'var(--ivory)';
const CINNABAR = 'var(--cinnabar)';
const INK = 'var(--ink)';
const GOLD = 'var(--goldleaf)';

// Suit shapes come from the shared registry (suits.tsx, the single source
// of truth — suit round): this module previously carried its own 24x28
// paths; only the shape SOURCE changed, the court geometry below is
// still the frozen master record. Suits must separate by SHAPE at sliver
// size (diamond cut sharper/narrower than the heart's round shoulders),
// which font suit rendering does not guarantee across platforms — the
// registry's whole premise. Fill colors stay THIS theme's palette.
// SUIT_FILL must stay token-aligned with table.css's .gd-card--red/--black
// pair: the corner SuitMark inherits THOSE via currentColor while the pip
// field and court cartouche fill with THESE — editing one wire without the
// other splits the corner from the body art (panel note, suit round).
export const SUIT_FILL: Record<SuitChar, string> = { S: INK, H: CINNABAR, D: CINNABAR, C: INK };
const isRed = (s: SuitChar) => s === 'H' || s === 'D';

// Robe palette: red suits cinnabar-dominant / black suits ink-dominant —
// palette REINFORCES the suit, the emblem pip carries it (shape-primary).
const robePalette = (s: SuitChar) =>
  isRed(s) ? { main: CINNABAR, accent: INK } : { main: INK, accent: CINNABAR };

// Trapezoid torso (wide belt, sloped shoulders) + sleeve wedges for an
// "arms" silhouette; V neckline for K/J, rounded U for Q.
function Robe({ suit, neck }: { suit: SuitChar; neck: 'V' | 'U' }): ReactElement {
  const p = robePalette(suit);
  return (
    <>
      <path d="M96 112 C88 118 84 128 82 140 L94 146 C98 134 104 126 112 120 Z" fill={p.accent} stroke={INK} strokeWidth="2" />
      <path d="M176 112 C184 118 188 128 190 140 L178 146 C174 134 168 126 160 120 Z" fill={p.accent} stroke={INK} strokeWidth="2" />
      <path d="M88 145 L92 108 C104 100 118 96 126 94 L136 90 L146 94 C154 96 168 100 180 108 L184 145 Z" fill={p.main} stroke={INK} strokeWidth="2" />
      <path d="M92 108 C100 116 102 130 102 145 L88 145 Z" fill={p.accent} />
      <path d="M180 108 C172 116 170 130 170 145 L184 145 Z" fill={p.accent} />
      {neck === 'V' ? (
        <>
          <path d="M116 104 L136 94 L156 104 L136 128 Z" fill={IVORY} />
          <path d="M116 104 L136 128 M156 104 L136 128" stroke={GOLD} strokeWidth="4" fill="none" />
        </>
      ) : (
        <>
          <path d="M118 102 L136 94 L154 102 C151 116 121 116 118 102 Z" fill={IVORY} />
          <path d="M118 102 C121 116 151 116 154 102" stroke={GOLD} strokeWidth="4" fill="none" />
        </>
      )}
    </>
  );
}

// Two ink eye strokes + cinnabar mouth: sub-pixel texture at ship sizes,
// craft at inspection size — never load-bearing for identity.
const Face = ({ mouthY }: { mouthY: number }): ReactElement => (
  <>
    <path d="M125 68 L133 68 M139 68 L147 68" stroke={INK} strokeWidth="2.5" fill="none" />
    <path d={`M131 ${mouthY} Q136 ${mouthY + 3} 141 ${mouthY}`} stroke={CINNABAR} strokeWidth="2.5" fill="none" />
  </>
);

// King: three-point gold crown + goatee + vertical sword. The sword is the
// K silhouette cue that survives 42.9px.
function KingBust({ suit }: { suit: SuitChar }): ReactElement {
  return (
    <>
      <g>
        <path d="M87 44 L97 44 L96 120 L88 120 Z" fill={IVORY} stroke={INK} strokeWidth="2.5" />
        <path d="M92 28 L99 46 L85 46 Z" fill={IVORY} stroke={INK} strokeWidth="2.5" />
        <line x1="92" y1="46" x2="92" y2="112" stroke={INK} strokeWidth="1.5" />
        <rect x="76" y="112" width="32" height="9" rx="4" fill={GOLD} stroke={INK} strokeWidth="2" />
        <circle cx="92" cy="128" r="5" fill={GOLD} stroke={INK} strokeWidth="2" />
      </g>
      <path d="M114 80 L114 64 C114 52 123 45 136 45 C149 45 158 52 158 64 L158 80 C158 93 149 102 136 102 C123 102 114 93 114 80 Z" fill={IVORY} stroke={INK} strokeWidth="2.5" />
      <path d="M111 58 C109 70 109 82 113 92 L119 88 C116 78 116 68 118 58 Z" fill={INK} />
      <path d="M161 58 C163 70 163 82 159 92 L153 88 C156 78 156 68 154 58 Z" fill={INK} />
      <Face mouthY={80} />
      <path d="M128 76 C131 74 134 75 136 77 C138 75 141 74 144 76 L144 79 C141 77 138 77 136 79 C134 77 131 77 128 79 Z" fill={INK} />
      <path d="M127 92 L145 92 L136 118 Z" fill={INK} />
      <Robe suit={suit} neck="V" />
      <path d="M108 42 L164 42 L159 58 L113 58 Z" fill={GOLD} stroke={INK} strokeWidth="2" />
      <path d="M108 42 L118 22 L128 42 Z M128 42 L136 14 L144 42 Z M144 42 L154 22 L164 42 Z" fill={GOLD} stroke={INK} strokeWidth="2" />
      <path d="M136 22 L142 30 L136 38 L130 30 Z" fill={CINNABAR} />
      <circle cx="118" cy="20" r="3" fill={GOLD} stroke={INK} strokeWidth="1.5" />
      <circle cx="136" cy="12" r="3" fill={GOLD} stroke={INK} strokeWidth="1.5" />
      <circle cx="154" cy="20" r="3" fill={GOLD} stroke={INK} strokeWidth="1.5" />
    </>
  );
}

// Queen: gold tiara + attached cinnabar hood-veil (the rounded red head
// silhouette that separates Q at fan sizes) + side flower.
function QueenBust({ suit }: { suit: SuitChar }): ReactElement {
  return (
    <>
      <path d="M106 46 C96 60 92 84 98 108 C104 116 110 120 118 122 L112 108 C106 88 108 64 116 50 Z" fill={CINNABAR} stroke={INK} strokeWidth="2" />
      <path d="M166 46 C176 60 180 84 174 108 C168 116 162 120 154 122 L160 108 C166 88 164 64 156 50 Z" fill={CINNABAR} stroke={INK} strokeWidth="2" />
      <path d="M112 62 C112 48 122 41 136 41 C150 41 160 48 160 62 L160 66 C154 57 146 54 136 54 C126 54 118 57 112 66 Z" fill={INK} />
      <path d="M114 80 L114 66 C114 55 123 48 136 48 C149 48 158 55 158 66 L158 80 C158 92 149 101 136 101 C123 101 114 92 114 80 Z" fill={IVORY} stroke={INK} strokeWidth="2.5" />
      <Face mouthY={82} />
      <Robe suit={suit} neck="U" />
      <path d="M110 46 C116 34 125 29 136 29 C147 29 156 34 162 46 L156 52 C150 42 144 39 136 39 C128 39 122 42 116 52 Z" fill={GOLD} stroke={INK} strokeWidth="2" />
      <path d="M136 22 L141 30 L136 38 L131 30 Z" fill={CINNABAR} />
      <g>
        <path d="M94 112 C90 100 90 88 94 78" stroke={INK} strokeWidth="2.5" fill="none" />
        <g fill={CINNABAR} stroke={INK} strokeWidth="1.5">
          <ellipse cx="94" cy="64" rx="5.5" ry="9" />
          <ellipse cx="94" cy="64" rx="5.5" ry="9" transform="rotate(72 94 70)" />
          <ellipse cx="94" cy="64" rx="5.5" ry="9" transform="rotate(144 94 70)" />
          <ellipse cx="94" cy="64" rx="5.5" ry="9" transform="rotate(216 94 70)" />
          <ellipse cx="94" cy="64" rx="5.5" ry="9" transform="rotate(288 94 70)" />
        </g>
        <circle cx="94" cy="70" r="5" fill={GOLD} stroke={INK} strokeWidth="1.5" />
      </g>
    </>
  );
}

// Jack: profile head + ink gauze hat with side wing + diagonal ji halberd
// and gold sash — the DIAGONAL is the J cue at fan sizes.
function JackBust({ suit }: { suit: SuitChar }): ReactElement {
  return (
    <>
      <g>
        <line x1="88" y1="140" x2="98" y2="34" stroke={INK} strokeWidth="5" />
        <path d="M97 12 L103 26 L91 26 Z" fill={GOLD} stroke={INK} strokeWidth="2" />
        <path d="M94 30 C82 38 76 52 78 68 C86 62 92 50 95 38 Z" fill={GOLD} stroke={INK} strokeWidth="2" />
        <circle cx="97" cy="30" r="3.5" fill={CINNABAR} stroke={INK} strokeWidth="1.5" />
      </g>
      <path d="M121 54 L115 62 L119 66 L114 76 L120 82 C121 90 127 97 138 98 C149 97 155 88 155 74 C155 60 148 52 137 52 L128 52 Z" fill={IVORY} stroke={INK} strokeWidth="2.5" />
      <path d="M120 66 L127 68 M124 76 L130 77" stroke={INK} strokeWidth="2.2" fill="none" />
      <path d="M148 58 C154 68 154 84 148 94 L140 97 C148 88 148 66 142 56 Z" fill={INK} />
      <circle cx="158" cy="62" r="8" fill={INK} />
      <Robe suit={suit} neck="V" />
      <path d="M104 108 L178 130 L174 141 L100 119 Z" fill={GOLD} stroke={INK} strokeWidth="2" />
      <path d="M116 52 C116 40 125 33 137 33 C149 33 158 40 158 52 L158 55 L116 55 Z" fill={INK} stroke={INK} strokeWidth="2" />
      <path d="M112 50 L162 50 L159 60 L115 60 Z" fill={GOLD} stroke={INK} strokeWidth="2" />
      <ellipse cx="165" cy="47" rx="11" ry="5.5" transform={'rotate(-22 165 47)'} fill={INK} />
    </>
  );
}

const BUSTS: Record<CourtChar, (props: { suit: SuitChar }) => ReactElement> = {
  K: KingBust,
  Q: QueenBust,
  J: JackBust,
};

/** Double-ended court figure: bust + 180° copy, gold meander belt across the
 *  mirror junction, suit pip in an ivory lozenge cartouche at the center. */
export function CourtFigure({ figure, suit }: { figure: CourtChar; suit: SuitChar }): ReactElement {
  const Bust = BUSTS[figure];
  return (
    <svg viewBox="0 0 200 290" aria-hidden="true" focusable="false">
      <g>
        <Bust suit={suit} />
      </g>
      <g transform="rotate(180 136 145)">
        <Bust suit={suit} />
      </g>
      <rect x="82" y="136" width="108" height="18" fill={GOLD} stroke={INK} strokeWidth="2" />
      <line x1="86" y1="145" x2="186" y2="145" stroke={INK} strokeWidth="5" strokeDasharray="7 6" />
      <path d="M136 122 L154 145 L136 168 L118 145 Z" fill={IVORY} stroke={GOLD} strokeWidth="3" />
      {/* Registry paths live in a 0 0 100 100 box, family ink height ~83
          units — scale 0.31 reproduces the old cartouche pip's ~26-unit
          ink inside the ivory lozenge, centered on the card center. */}
      <g transform="translate(136 145) scale(0.31) translate(-50 -50)">
        <path d={SUIT_PATHS[suit]} fill={SUIT_FILL[suit]} />
      </g>
    </svg>
  );
}
