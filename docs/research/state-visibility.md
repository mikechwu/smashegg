# State visibility for elders — turn, clock, selection, staging (playtest round 2, items 1/3/4)

**Status:** PROPOSAL — awaiting owner sign-off. Item 2 (the selection-reset bug)
is fixed separately in this round and is NOT gated on this plan.
**Date:** 2026-07-22
**Provenance:** four-agent research sweep (codebase signal inventory; turn/timer
precedents incl. 掼蛋/斗地主 apps, Hearthstone, chess.com, UNO!, Words with
Friends; staging mechanics incl. Balatro, Marvel Snap, Tichu/BGA, Big Two;
elder-HCI literature incl. touch-target, redundant-coding, aging-vision,
WCAG motion, JMIR senior-game guidelines) + two INDEPENDENT design proposals
(Codex, Grok — both blind to each other; both later also audited the item-2
fix, which they did not produce). The two designers converged on the same
architecture unprompted; where they diverge it is flagged as an owner decision.

## 1. Diagnosis

The playtest theme in one sentence: the facts all exist, but as distributed
micro-chrome. Whose turn = a 0.9rem topbar sentence + a 3px hue-only pill
ring; the own clock = two 0.85rem number chips with zero escalation between
90s and 11s (and under reduced motion, not even the pulse); selection = a
2px cinnabar hairline + 6px nudge on an ~18px visible strip inside a value
pile; combination identity is spoken ONLY on failure (the reason line) or
inside the wild chooser. Elders whose model is the physical table — where
turn, clock and intent are all carried spatially and kinetically for free —
get none of those channels. The elder-HCI literature is unambiguous: every
load-bearing state needs redundant coding (position + text + color), steady
states beat pulses (elders disengage slowly from attentional capture; lens
yellowing kills cool-hue contrast), and finger precision rules out drag.

## 2. The unified design: 出牌台 (the play desk)

The physical game concentrates "my decision" in one place: you pull the
intended cards proud of the fan into a little group between hand and table,
look at it, then push it in or take it back. The digital translation — one
surface, mounted between the HandFan and the Play/Pass row, that owns four
jobs at once:

```
┌─ 出牌台 ────────────────────────────────────┐
│  輪到你出牌                        [ 28 ]   │   title row + big own-clock
│  [9♣][9♥]                                   │   staged faces (full size)
│  即將出：對子 9 · 壓得過                     │   live combo + beat verdict
└─────────────────────────────────────────────┘
        [    出牌    ]        [    過    ]
```

The hierarchy of loudness (non-negotiable, both designers + the elder
research concur): (1) YOUR turn with a running clock — maximum, and the
ONLY state allowed the strongest treatment; (2) your turn untimed — loud
identity, no clock chrome, no fake timer; (3) staged cards — always
readable; (4) someone else's turn — one calm headline sentence + the
existing quiet plate ring, no desk chrome; (5) ceremony/deal/interlude —
desk hidden (today's suppression gates carry over unchanged).

Why one surface instead of three louder chips: turn-arrival CREATES the
desk, staging FILLS it, confirm EMPTIES it onto the trick — the active
state becomes obvious by having a place to happen (the brief's "strong
version", and both independent designers judged the unification holds,
provided opponent turns stay quiet and the wild chooser remains the
specialist for multi-reading declarations).

### 2a. Whose turn (item 1)

- Your turn: the desk mounts with a one-shot ~200ms entrance (reduced
  motion: instant, static underfill) into a STEADY high-contrast state —
  cinnabar shell on the desk, title 「輪到你出牌」 at ≥1.125rem/700. Never a
  loop, never a blink (WCAG 2.3.1 + elder attention-capture findings).
- Someone else's turn: headline keeps 「輪到 {name}」 + their small clock
  chip; the seat plate ring stays as the peripheral cue. No desk shell.
  The strongest vocabulary is reserved for the state with a consequence.
- The bottom half of the screen currently carries NO whose-turn signal on
  others' turns; the desk's absence-vs-presence becomes that signal.

### 2b. The own clock (item 4)

- ONE primary own-clock, on the desk title row: 1.5rem tabular seconds
  (today: 0.85rem chip). The duplicate `gd-handclock` above the sort pill
  is REMOVED (a number without a home). The headline chip remains for
  OTHER seats' turns only.
- Planning vs turn reads as two visual registers: planning = goldleaf
  outline + 「起手思考」; normal turn = cinnabar register (the desk title
  already says 出牌).
- Urgency is a discrete calm ramp, not a per-second throb: neutral →
  amber → red stages with a thin remaining-fraction bar (total estimated
  from the room's timing preset, already on the client — NO wire change),
  and at ≤10s the number goes bold cinnabar with the copy
  「請快出牌 · 還剩 {n} 秒」. Reduced motion: the same stages minus any
  pulse — color + weight + words carry it (today reduced motion loses the
  only urgency signal that exists).
- Untimed rooms: the clock column is simply absent; the desk still says
  「輪到你出牌」. No empty chrome, no fake numbers (Words-with-Friends
  degradation: the turn signal and the timer are separable systems).
- Timeout consequence, taught (client-only): when the fold sees YOUR seat
  auto-passed by the server clock, a transient desk notice
  「時間到，已自動過牌」 so the consequence is learned the first time it
  happens instead of reading as a glitch (欢乐斗地主 model; the feed line
  alone is too quiet). No 托管/trusteeship system — that would be server
  scope, out of bounds this round.

### 2c. Selection + staging (item 3)

Two cooperating layers — the fan answers "which slots did I touch", the
desk answers "what am I about to play":

- Fan: lift raised from −6px to ~−14px, selected ring upgraded (ivory
  outer + cinnabar, or a scale bump) so it survives pile occlusion at
  390px; reduced motion keeps ring + underfill without transform.
- Desk stage: the selected cards render as FULL faces in a horizontal
  strip (the trick well's overlap), dual-rendered (cards stay in the fan
  with their ring; the stage is clearly captioned 即將出 so it cannot
  read as a clone). Tap a staged face = deselect. NO drag anywhere in
  the core loop (elder motor research is decisive), no extract-reflow of
  the fan (elders navigate by pile position; v1.1 option if dual-render
  confuses).
- The live combo line is the misread-killer (Balatro's proven loop, the
  only mechanism found in the wild that catches LEGAL-but-misread plays):
  recomputed on every toggle from the existing pure helpers (comboKey,
  comboRankLabel, declRunText, beatState, matchSelection — zero new
  classification logic):
  - no reading: 「牌組不成型」 (Play disabled, as today)
  - one reading: 「即將出：對子 9」 (+ 「壓得過」/「壓不過」 verdict)
  - multiple readings (wilds): 「即將出：多種出法」, Play opens the
    EXISTING chooser — never auto-opened on selection, never a second
    wild UI.
- Tribute phases retitle the same desk (「輪到你進貢」/「輪到你還貢」, the
  one eligible face staged, primary button 貢牌/還貢) — one muscle memory.
  Anti-tribute and the cut keep their own panels (different grammar).
- Pre-staging while waiting (both designers recommend): the stage + combo
  label render QUIETLY during others' turns (no shell, no clock, Play
  disabled) — this composes directly with the item-2 fix, which is what
  makes pre-selection survive to the turn at all.

### 2d. 390px budget (zh-Hant, the binding constraint)

Content width ≈374px; hand card ≈50.7px wide (13vw), stage strip at 0.4
overlap: pair 71px, 5-card 132px, 10-card 233px — horizontal is easy.
Vertical is the tax: full desk ≈148px, found by recycling, not inventing:
the ActionBar's reserved reason band (~36px) moves into the desk; the
handclock cell goes; the ring center is allowed to shrink ~48–56px while
the desk is open (`gd-table--acting`); empty desk (your turn, nothing
staged) is the compact ~60px form 「輪到你出牌 · 點選手牌，放到這裡再出」and
grows on first selection. Over-selection past any legal size shows the
first ~10 faces + 「+{n}」 chip so a 27-card mis-tap spree cannot eat the
screen. The desk and the Play button must stay on screen TOGETHER.

## 3. What NOT to do (the overload guard)

No blinking or looped pulsing anywhere (one gentle entrance, then steady).
No sound as a required channel (muted-by-default norms; if added later:
one familiar table sound or spoken 「該你了」, never an abstract chime —
and it is NOT in this round). No per-seat clocks back on the plates (the
flank round removed them deliberately). No opponent-turn theatrics. No
drag. No legality glow across the fan (legality is combo-contextual;
the desk verdict line is the honest cue). No second wild UI. No fake
timers in untimed rooms. No engine/protocol/timing changes anywhere —
staging is pure client presentation over the existing selection set;
the DO alarm remains the sole enforcer. Frozen art modules untouched.

## 4. Implementation shape (build round, after sign-off)

- New `PlayDesk.tsx` (title/clock/stage/verdict; props-only), optional
  `StageStrip` private to it. ActionBar reduces toward buttons+chooser;
  its reason line moves into the desk. HandFan: stronger selected state.
  GameTable: derive desk props (yourTurn, dueSeconds, timingClass,
  matches, selectionCards, tributePhase); mount desk; drop handclock.
  TableHeadline: your-turn clock demoted per decision D4. table.css:
  desk block + `gd-table--acting` ring shrink + reduced-motion statics.
  i18n: ~15 new keys ×3 locales (zh-Hant wording above).
- Ratchet: combo-preview line is a pure function → direct pins ("these
  selected cards name X"); desk state machine (which register renders
  when) → stage-conditional render pins; wiring/CSS pins for the gates,
  the steady-state rule (no animation-iteration-count:infinite outside
  the existing clock pulse), the reduced-motion block, and the untimed
  degradation. Visual verify desktop + TRUE 390px, locale stated.
- Panel: Codex and Grok both served as design consultants here, so per
  the producer≠auditor rule they audit code-vs-plan conformance (as with
  the interlude), disclosed as anchored.

## 5. Owner decisions (recommended defaults in bold)

D1 — Desk architecture: **full 出牌台 with staged faces strip (dual-render)**
vs label-only-above-buttons (cheaper, zero vertical cost, but still makes
the elder read the combo off the fan). Both independent designers chose
the desk; the research's Balatro evidence supports at minimum the live
label.
D2 — Pre-staging while waiting: **yes, quiet form** (no shell/clock, Play
disabled) vs desk only on your turn.
D3 — Fan treatment while staging: **mild dim (~0.72) of unselected piles
on your turn with a non-empty selection**; off under reduced motion.
D4 — Headline on YOUR turn at 390px: **teams only — the desk owns the turn
sentence and clock** (headline echo stays on desktop ≥720px) vs keeping
the duplicate sentence+chip.
D5 — Urgency ramp: **discrete neutral→amber→red stages + fraction bar from
the room timing preset + ≤10s bold copy** vs number-only escalation.
D6 — Timeout notice 「時間到，已自動過牌」: **include** (client-only fold
detection) vs defer.
D7 — Sound/haptics: **defer entirely** (design keeps a slot for one
optional familiar-sound cue later).
