# Pre-M5 UX/UI audit — Phase A (player-perspective, collect-don't-fix)

**Date:** 2026-07-15 · **Target:** deployed build f6d6bc6 · **Method:** computer-use
self-play, desktop 1440px + true 390px (via an injected same-origin iframe, since the
Chrome window clamps at innerWidth 606), judged as a first-time family player.
Companion research digest (grounded, 11-agent workflow): design-system fundamentals,
four-handed layouts, small-screen legibility, CJK/a11y — findings folded into the
restyle proposal, not this audit.

Severity: **P1** a first-timer is confused / can't proceed or sees internal data ·
**P2** friction · **P3** polish. Must-see tags: [T] whose-turn · [L] level 打幾 ·
[W] wild 紅心級牌 · [B] what to beat · [H] hand · [G] legal hints · [C] card counts ·
[P] partner · [K] clock/planning · [A] A-attempt · [!] must-NOT-see.

## The one structural finding that frames everything (§2)

`seatLayout(viewer)` already maps `south=you, north=(viewer+2)=partner, east/west=the
two opponents` — the ring **semantics already exist and match the physical convention**.
But they render as a **3-plates-across-the-top row + your hand at the bottom**, with a
large empty center. Consequences a first-timer feels: partner-vs-opponent is invisible
(F5), the CCW turn direction reads as a scatter across the top rather than travel around
a table, and on 390px the stacked rows crowd the hand. Converting to the asymmetric ring
(you bottom, partner across the top, opponents flanking a bounded center) is a **layout
restructure, not a seat-logic change** — and it's the canvas every other visual decision
sits on, so it must be decided in the plan first.

## P1 — confusion or leaked internals

- **F3 · Raw error code leaks; pre-seat pickers rejected; error is sticky and duplicated.**
  In a freshly created lobby the creator is not yet seated, but the rule/timing pickers
  look editable. Clicking one is server-rejected (only seated players may edit) and shows
  **「動作被拒絕(room.notSeated)」** — the raw semantic code, in every locale ("Action
  rejected (room.notSeated)"). `room.notSeated` has no i18n key → falls through
  `game.error.unknown` → prints the code ([!] violation of "codes are for logs, not
  humans"). Worse: the rejection **never clears** — it persists through successful seat
  claims and **into the game**, where it renders on TWO surfaces at once (app-shell banner
  + in-table toast) and the toast physically covers the hand. A page reload clears it (it's
  per-session client state). Fixes: (a) disable pickers until seated; (b) map every
  `room.*`/`config.*`/`timing.*` code to human copy — audit the whole error map; (c) reset
  the rejection list on lobby→game and clear stale errors on success.
- **F4 · Table is top-heavy; opponents don't flank the center.** See the framing finding
  above. Desktop wastes a vast empty center; 390px over-stacks. [P][T]
- **F5 · No partner/team cue on the plates.** Nothing marks 阿華 as MY partner; the 我隊/對方
  markers live only on the level rail. A first-timer can't tell partner from opponents. The
  ring's partner-across-top is the fix, plus a non-positional team cue (don't encode
  partnership by position alone). [P] FAILS.

## P2 — friction / under-served facts

- **F6 · The wild (紅心級牌) is never stated on the table** — only the 配 corner marker on a
  wild card you happen to hold. If you don't hold one, nothing says "the wild is 紅心2."
  Needs an always-present wild indicator by the level. [W]
- **F7 · The level (打幾) is present but not headlined.** Conveyed by the level rail (current
  rank at the BOTTOM of a 13-row ladder) + a one-time feed line. The brief calls it "the
  most under-served critical fact." Wants a persistent, prominent 打X headline (with the
  wild), esp. on mobile. [L]
- **F8 · Whose-turn on YOUR seat is spectator-phrased.** When it's your turn the dominant
  center text reads "等 [你的名字] 領出" ("waiting for you"), not "輪到你了." The only real
  cues are the enabled 出牌 button + a thin plate border (easy to miss at 390px). Research
  echo: announce whose-turn in WORDS naming the player, as the single source of truth. [T]
- **F9 · Legal-play hints invisible during a normal turn** (owner decision). Facing
  "阿強・單張9", the fan shows all 27 cards with no cue which are legal. Per-card `glow` is
  tribute-only. NUANCE: per-card legality is genuinely ambiguous in Guandan (an 8 is illegal
  as a single but legal in a bomb), which is why it's tribute-only. Options to discuss: a
  "需壓過 單張9" line by the action bar, or highlighting beating singles when nothing is
  selected. Not a silent fix. [G]
- **F11 · Card counts have no low-count (報牌) emphasis** (confirmed from `SeatPlate.tsx`: the
  count chip is value-independent). A seat at 2 cards looks identical to one at 27. Research
  (official 報牌 rule): ≤10 is the urgency line — escalate the count (size/border/icon),
  sharper at 1–2. [C]

## P3 — polish / verify

- **F1 · Lobby seats are a 2×2 grid** (persists at mobile width) — same partnership-invisible
  problem; becomes the lobby ring.
- **F2 · Game-name glyph:** zh-Hant uses 掼蛋; strict Traditional is 摜蛋. Widely accepted, likely
  intentional — owner confirm.

## Keep (don't break in the restyle)
Home hero + create CTA; room-code hero + copy-link; the **rule picker** (titled group +
plain-language explanation + segmented pills + selected-option description) and timing
picker; the ceremony (翻牌定先, clear + tappable skip); the **level rail** (encodes real
state); the wild **配 marker** (legible, localizes 配/w); card counts on every plate; the
trick well ("名字・牌型"); **CCW turn order** (south→east→north→west, correct); the hand fan
(27 cards ≤2 rows, legible at true 390px, no overflow, clear selection lift); descending-sort
toggle; **3-locale integrity** (no reflow, natural copy, names verbatim); the planning-vs-turn
clock distinction (起手思考 label; dims under the ceremony).

## Deliberately NOT re-driven live (recently verified M3/M4; Phase-B re-verify against the ring)
Wild multi-reading chooser (a lone wild correctly plays as 單張2, no chooser); tribute /
anti-tribute / 接風 panels; match-end result overlay; a live "1–2 cards" state (inferred from
code, F11). These sit inside the center zone the ring restructures — re-verifying pre-restyle
would be throwaway. Flagged so the owner can redirect if live captures are wanted this pass.
