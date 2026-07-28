> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Seat bubble overlay BUILT local (2026-07-22) — the ask floats above the table with a tail at the pressed seat; awaiting the owner's deploy word

Owner overlay round: the inline SEAT DRAWER (923bdec) is replaced by a small
speech-bubble OVERLAY that floats above the table with a TAIL pointing at the
seat being claimed. The drawer's one practical weakness — it was inserted into
the grid flow, so opening it REFLOWED the lobby — is gone: the bubble is
`position:absolute`, out of flow, and the table's className is now CONSTANT
(the old grid-area swap that reflowed is deleted). The prior mechanic is
recorded as superseded, NOT rewritten, in docs/research/seat-entry-placement.md
(METHODOLOGY §9 banner) — the drawer research stays valid as the record of why
we got here.

Belongs-to is now the TAIL alone (the 「入座:{position}」 text label is gone —
the pointer does the work; the seat identity still reaches assistive tech
through the input's aria-label). The bubble is anchored INSIDE the pressed
seat's own wrapper, so the tail aims BY CONSTRUCTION: top/bottom seats center
the bubble on the seat's x-axis, the flanks on its y-axis — robust to the other
seats' chip heights, no measurement. Each seat opens its bubble toward the
table CENTER, keeping all four in the upper-central band. Spare by design: just
the input, the 坐下 confirm, and a corner × — the steady prompt line is gone.

COLOUR (owner feedback: the first dark-on-dark tail was hard to link to a
seat). Redesigned as a LIGHT ivory callout with a CINNABAR edge and a bigger
bordered ARROW (a cinnabar rim continuing the body border over an ivory fill) —
a high-contrast figure on the dark lacquer table, and the shared cinnabar
color-codes the bubble to its seat, whose highlight is now a cinnabar ring +
glow (Gestalt similarity: red arrow → red seat). Dark ink on ivory (AAA); the
confirm stays cinnabar. Re-verified live at 390px zh-Hant across all four seats
— the arrow reads clearly and points at the ringed seat each time.

LAST-PRESSED-SEAT-WINS (new): pressing a DIFFERENT seat while the bubble is open
RETARGETS it — the single sitAsk target moves, so the old seat's bubble unmounts
and the new one mounts (the tail follows; autofocus re-fires with no key). A
retarget PRESERVES the typed name (the seat changed, not the person) and resets
the needName/claiming flags; it claims NOTHING. The ONE claim path (takeSeat →
store.claim) is UNTOUCHED — store.claim appears exactly once, takeSeat is called
in exactly two places (the name-ready fast path and the bubble confirm), never
in the retarget branch, so a retarget can neither double-claim nor half-claim.

KEYBOARD (the constraint that killed floating panels last time): the bubble is
`absolute` (in the scrollable document), NOT `fixed`, so iOS's native
scroll-focused-input-into-view still fires — the same mechanism the drawer
relied on. Input stays 16px (no iOS auto-zoom, guard 3, pinned). Real
soft-keyboard occlusion is UNPROVABLE in the 390px iframe (it has no keyboard)
— batched into the pending M5 real-iPhone session.

Live-verified at true 390px zh-Hant (a real dev lobby in a 390px iframe): all
four seats measured with ZERO cross-axis offset (tail dx=0 for top/bottom,
dy=0 for flanks — exact aim), every bubble fully on-screen and in the central
band; retarget moves the tail + preserves the name (阿明) with 0 seats claimed;
confirm mints the token and seats the player (isYou), bubble closes on success.

PANEL (the owner's cumulative seat-path ask — 4th seating round): Codex
(reasoned-only) + Grok (suite green + mutation-tested the 5 new pins, 0 slips) +
a 9-agent workflow sweep (adversarially verified). VERDICT: the load-bearing
token/redaction semantics HOLD across the accumulated changes — store.claim ×1,
takeSeat ×2 (never in the retarget branch), server sends the token only to the
claimer + persists hash-only, the client stores only its OWN token, the UI never
touches a foreign token. Findings, all fixed same-round: MED (Codex) the flank
tail anchored to the seat WRAPPER not the chip — off on WIDE layouts; fixed by
anchoring the bubble inside .lobby-seat, re-verified at 760px (tail tracks the
chip, 64px wrapper gap notwithstanding). LOW (Codex) retarget preserved the name
even with a confirm in flight — fixed with a claimInFlight guard (the sweep then
REJECTED a duplicate-claim finding because of it). LOW + INFO (sweep,
PRE-EXISTING, byte-identical to the drawer panel at 923bdec, NOT regressions):
Enter bypassed the disconnect-disabled confirm — fixed (onConfirm guards
!connected); the claiming hint was not a live region — fixed (role=status).
LOW (Grok) a pin could match a vacuous window — hardened. docs/audits/seat-bubble-overlay.md.

Gate 1072/1072 (45 files) + typecheck (4 tsconfigs) + lint:hooks + build
(bundle ~unchanged). Every carry-over pin (sit-then-name, prefill,
claiming-lock, race, close-on-success, in-flight stamp) still passes untouched.
NOT pushed — this round's order carries no deploy word. Batched into the pending
M5 real-iPhone session: soft-keyboard occlusion of the bubble (the iframe has no
keyboard — unprovable there), plus the still-open elder checks.
