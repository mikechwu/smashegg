// Cinnabar Court — the five hand-drawn pieces (3 court figures x 4 suits by
// emblem + palette, 2 jokers), drawn in the app's Eastern-minimalist idiom.
// Geometry is the master record: it passed the craft gate at ship sizes
// (docs/design/deck-themes/cinnabar-court/DESIGN.md §5) — edits here must
// re-clear that gate, not just look right at inspection size.
//
// Card space is 200x290 (aspect 1.45). Courts are double-ended: one bust
// mirrored by rotate(180 136 145) — about the FIGURE column's center
// (x∈[76,196]), not the card's, so both halves stay clear of the top-left
// identity column. Everything paints with the table palette tokens only.

import type { ReactElement } from 'react';

export type SuitChar = 'S' | 'H' | 'D' | 'C';
export type CourtChar = 'K' | 'Q' | 'J';

const IVORY = 'var(--ivory)';
const CINNABAR = 'var(--cinnabar)';
const INK = 'var(--ink)';
const GOLD = 'var(--goldleaf)';

// Suit glyphs are theme-drawn paths, not font glyphs: suits must separate by
// SHAPE at sliver size (diamond cut sharper/narrower than the heart's round
// shoulders), which font ♥/♦ rendering does not guarantee across platforms.
export const SUIT_GLYPH_VIEWBOX = '0 0 24 28';
export const SUIT_PATHS: Record<SuitChar, string> = {
  S: 'M12 1 C8.5 8 3 12 3 16.5 C3 20.5 7 22.5 10.2 20.4 C10.2 22.8 9.2 24.6 7.5 26.5 L16.5 26.5 C14.8 24.6 13.8 22.8 13.8 20.4 C17 22.5 21 20.5 21 16.5 C21 12 15.5 8 12 1 Z',
  H: 'M12 26 C6 19.5 2 15.5 2 10 C2 6 5 3.5 8.3 3.5 C10 3.5 11.4 4.6 12 5.6 C12.6 4.6 14 3.5 15.7 3.5 C19 3.5 22 6 22 10 C22 15.5 18 19.5 12 26 Z',
  D: 'M12 1.5 L19.5 14 L12 26.5 L4.5 14 Z',
  C: 'M12 2.5 C14.9 2.5 17.2 4.8 17.2 7.7 C17.2 9 16.7 10.2 15.9 11.1 C16.6 10.7 17.5 10.5 18.4 10.5 C21.3 10.5 23.6 12.8 23.6 15.7 C23.6 18.6 21.3 20.9 18.4 20.9 C16.6 20.9 15 20 14.1 18.6 C14.3 21.3 15.2 24.4 16.5 26.5 L7.5 26.5 C8.8 24.4 9.7 21.3 9.9 18.6 C9 20 7.4 20.9 5.6 20.9 C2.7 20.9 0.4 18.6 0.4 15.7 C0.4 12.8 2.7 10.5 5.6 10.5 C6.5 10.5 7.4 10.7 8.1 11.1 C7.3 10.2 6.8 9 6.8 7.7 C6.8 4.8 9.1 2.5 12 2.5 Z',
};
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
      <g transform="translate(124,131)">
        <path d={SUIT_PATHS[suit]} fill={SUIT_FILL[suit]} />
      </g>
    </svg>
  );
}

/** Big joker: full-palette jester — opera-mask face, lobed cap with gold
 *  bells, cinnabar center robe, gold cloud ring. Single-ended. */
export function BigJokerFigure(): ReactElement {
  return (
    <svg viewBox="0 0 200 290" aria-hidden="true" focusable="false">
      <circle cx="100" cy="158" r="72" fill="none" stroke={GOLD} strokeWidth="3" />
      <path d="M34 132 C24 124 22 112 30 104 C34 112 38 120 46 124 Z" fill={GOLD} />
      <path d="M166 132 C176 124 178 112 170 104 C166 112 162 120 154 124 Z" fill={GOLD} />
      <path d="M100 62 C88 60 76 52 68 40 C82 38 94 42 100 50 Z" fill={INK} />
      <path d="M100 62 C112 60 124 52 132 40 C118 38 106 42 100 50 Z" fill={INK} />
      <path d="M92 56 C92 42 96 30 100 24 C104 30 108 42 108 56 Z" fill={CINNABAR} />
      <circle cx="100" cy="22" r="5" fill={GOLD} />
      <circle cx="66" cy="40" r="5" fill={GOLD} />
      <circle cx="134" cy="40" r="5" fill={GOLD} />
      <path d="M84 72 C84 60 91 54 100 54 C109 54 116 60 116 72 C116 84 109 92 100 92 C91 92 84 84 84 72 Z" fill={IVORY} stroke={INK} strokeWidth="2.5" />
      <path d="M90 70 C92 66 96 66 98 70 M102 70 C104 66 108 66 110 70" stroke={INK} strokeWidth="2" fill="none" />
      <path d="M93 80 C97 85 103 85 107 80" stroke={CINNABAR} strokeWidth="2.5" fill="none" />
      <path d="M100 60 L103 64 L100 68 L97 64 Z" fill={CINNABAR} />
      <g>
        <path d="M76 96 L92 104 L78 114 Z" fill={INK} />
        <path d="M124 96 L108 104 L122 114 Z" fill={INK} />
        <path d="M100 92 L112 100 L100 114 L88 100 Z" fill={CINNABAR} stroke={INK} strokeWidth="1.5" />
      </g>
      <path d="M74 112 C62 150 58 196 66 238 L86 246 C78 200 80 152 88 114 Z" fill={INK} />
      <path d="M126 112 C138 150 142 196 134 238 L114 246 C122 200 120 152 112 114 Z" fill={INK} />
      <path d="M88 112 L112 112 C120 158 122 208 114 250 L86 250 C78 208 80 158 88 112 Z" fill={CINNABAR} stroke={INK} strokeWidth="2" />
      <path d="M100 112 L100 250" stroke={GOLD} strokeWidth="3" />
      <circle cx="100" cy="136" r="5" fill={GOLD} />
      <circle cx="100" cy="164" r="5" fill={GOLD} />
      <circle cx="100" cy="192" r="5" fill={GOLD} />
      <path d="M74 114 C60 122 50 134 44 150 L56 156 C62 142 72 130 84 124 Z" fill={INK} />
      <path d="M126 114 C140 122 150 134 156 150 L144 156 C138 142 128 130 116 124 Z" fill={INK} />
      <path d="M44 150 L56 156 L50 166 L40 158 Z" fill={CINNABAR} />
      <path d="M156 150 L144 156 L150 166 L160 158 Z" fill={CINNABAR} />
    </svg>
  );
}

/** Small joker: pure-ink silhouette jester — spiked cap, winged shoulders,
 *  mask face, ivory robe slits. Distinct from big by silhouette AND colour
 *  amount, never colour alone. Single-ended. */
export function SmallJokerFigure(): ReactElement {
  return (
    <svg viewBox="0 0 200 290" aria-hidden="true" focusable="false">
      <path d="M100 54 L92 20 L100 30 L108 20 Z" fill={INK} />
      <path d="M96 50 L74 30 L88 52 Z" fill={INK} />
      <path d="M104 50 L126 30 L112 52 Z" fill={INK} />
      <circle cx="74" cy="29" r="3.5" fill={INK} />
      <circle cx="126" cy="29" r="3.5" fill={INK} />
      <circle cx="100" cy="19" r="3.5" fill={INK} />
      <path d="M84 66 C84 52 91 46 100 46 C109 46 116 52 116 66 C116 78 109 88 100 88 C91 88 84 78 84 66 Z" fill={INK} />
      <path d="M88 68 C88 56 93 51 100 51 C107 51 112 56 112 68 C112 78 107 84 100 84 C93 84 88 78 88 68 Z" fill={IVORY} />
      <path d="M91 66 C93 63 96 63 98 66 L98 68 C96 66 93 66 91 68 Z" fill={INK} />
      <path d="M102 66 C104 63 107 63 109 66 L109 68 C107 66 104 66 102 68 Z" fill={INK} />
      <path d="M97 77 C99 79 101 79 103 77 L103 79 C101 80 99 80 97 79 Z" fill={INK} />
      <path d="M100 88 C88 92 76 92 64 100 C50 108 42 120 40 132 L52 128 C58 116 70 106 84 102 L100 96 L116 102 C130 106 142 116 148 128 L160 132 C158 120 150 108 136 100 C124 92 112 92 100 88 Z" fill={INK} />
      <path d="M40 132 C30 138 24 146 22 156 L34 152 C38 144 44 138 52 134 Z" fill={INK} />
      <path d="M160 132 C170 138 176 146 178 156 L166 152 C162 144 156 138 148 134 Z" fill={INK} />
      <path d="M78 104 C64 150 60 200 72 248 L98 262 L100 262 L100 100 Z" fill={INK} />
      <path d="M122 104 C136 150 140 200 128 248 L102 262 L100 262 L100 100 Z" fill={INK} />
      <path d="M86 130 C80 172 80 214 90 244 L97 240 C89 210 89 172 94 134 Z" fill={IVORY} />
      <path d="M114 130 C120 172 120 214 110 244 L103 240 C111 210 111 172 106 134 Z" fill={IVORY} />
      <path d="M100 138 L106 152 L100 166 L94 152 Z" fill={IVORY} />
      <path d="M100 262 L100 274 M72 250 L70 262 M128 250 L130 262" stroke={INK} strokeWidth="3" />
      <circle cx="100" cy="277" r="3" fill={INK} />
      <circle cx="69" cy="265" r="3" fill={INK} />
      <circle cx="131" cy="265" r="3" fill={INK} />
    </svg>
  );
}

// Joker corner emblems: wordless identity-column glyphs (the sliver identity).
// Big = filled cinnabar curled-lobe cap + diamond; small = ink sharp-spike
// cap + hollow mask. Distinct silhouettes first, colour amount second.
export const JOKER_EMBLEM_VIEWBOX = '0 0 44 64';

export function BigJokerEmblem(): ReactElement {
  return (
    <svg viewBox={JOKER_EMBLEM_VIEWBOX} aria-hidden="true" focusable="false">
      <path d="M22 34 C17 27 10 25 3 28 C5 17 12 10 20 11 C20 6 21 3 22 1 C23 3 24 6 24 11 C32 10 39 17 41 28 C34 25 27 27 22 34 Z" fill={CINNABAR} />
      <circle cx="4" cy="24" r="3.8" fill={CINNABAR} />
      <circle cx="40" cy="24" r="3.8" fill={CINNABAR} />
      <path d="M22 40 L30 51 L22 62 L14 51 Z" fill={CINNABAR} />
    </svg>
  );
}

export function SmallJokerEmblem(): ReactElement {
  return (
    <svg viewBox={JOKER_EMBLEM_VIEWBOX} aria-hidden="true" focusable="false">
      <path d="M22 30 L14 8 L22 16 L30 8 Z" fill={INK} />
      <path d="M18 29 L4 18 L15 31 Z" fill={INK} />
      <path d="M26 29 L40 18 L29 31 Z" fill={INK} />
      <circle cx="4" cy="15" r="3" fill={INK} />
      <circle cx="40" cy="15" r="3" fill={INK} />
      <circle cx="22" cy="7" r="3" fill={INK} />
      <path d="M11 40 C11 31 16 27 22 27 C28 27 33 31 33 40 C33 48 28 53 22 53 C16 53 11 48 11 40 Z" fill="none" stroke={INK} strokeWidth="3.4" />
      <path d="M16 39 L20 39 M24 39 L28 39" stroke={INK} strokeWidth="2.8" />
    </svg>
  );
}
