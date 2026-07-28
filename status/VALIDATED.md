# VALIDATED

> **Answers:** for a quantity in the model — is it measured or modelled, at what n, in what
> configuration, and over what range may it be quoted? **The value itself:** `MODEL.md`.
> **What is decided or open because of it:** `CURRENT.md`. **What has been retracted:**
> `WITHDRAWN.md`.

This file exists because three of this project's recurring errors are the same missing
field, not three different mistakes:

| the error | the instance | the field that was missing |
|---|---|---|
| a **sampled** bound worded as **structural** | `fanHeight <= 465.1px, structural` — it was the maximum of a simulation, and the case it names arrives about 1 deal in 5 billion | status, and the n behind it |
| a **model tail** used as a **gate** | discriminating 0.08% from 0.74%, two orders of magnitude below the smallest bin any measurement validated | validated-over range |
| a constant measured in **one pinned configuration**, quoted as general | every desk figure before 2026-07-27 was measured in an UNTIMED room while the product default is timed, a difference of 8.0px no gate had varied | configuration |

Each row below therefore carries the field whose absence produced the error. **A row with
no range is not a validated quantity**; it is a reading.

## Status vocabulary

| status | means | may be quoted as |
|---|---|---|
| `measured` | read from a rendered page, n stated | fact, within the stated configuration |
| `modelled` | computed from the model, not itself observed | a model output, always with the word "modelled" |
| `held-out` | modelled, then confirmed against data the model never saw | the strongest thing here |
| `definitional` | a value the code declares; nothing to validate | fact |
| `structural` | true by construction over the whole domain, not by sampling | a bound |
| `sampled-bound` | the extreme of a finite sample | never as a bound without its n and its frequency |

## Rows

| id | status | n | configuration | validated over | notes |
|---|---|---|---|---|---|
| `cardW` | `definitional` | — | — | widths 360-719 | The shipped constant. Its *consequences* are the rows below. |
| `glyphCap` | `measured` | 7,668 card renders, 13 of 15 value classes | inner 390x664, lacquer, zh-Hant, root 12-24px | the ink basis 40-110px at cardW 48.15 | First escape at 62px (index/pip collision); 58 ships, 4px of setback. Not re-measured at another card width — the cap is stated for the shipped box only. |
| `aspect` | `definitional` | — | all themes | all | CSS declares 1.45. The scripts carry 1.44970; see MODEL's disagreement note. |
| `stripW` | `definitional` | — | **lacquer only** | lacquer | cinnabar-court is 0.841. Every span figure in this model is a lacquer figure. |
| `fanChrome`, `fanRowGap` | `measured` | — | inner 390 wide, lacquer | not re-measured at another width | Not card-scaled (F5a). |
| `rowChrome` | `measured` | 4 widths | lacquer, root 16px | 320-430 | Calibrated to within 0.04px across those four widths. |
| `deskMinusCard` | `measured` | — | timed room; `bar = 4` is timed-only | the reference cell | Decomposes to its parts with **0** residual. |
| `kMinusCard` | `measured` | — | following state (well renders) | the reference cell | Parts sum to 125.0 against 125.1: residual **0.1px**, not the 0 once recorded. |
| `kLead` | `measured` | — | leading state (well empty) | the reference cell | Carries no card term. |
| `capacityFloor` | `structural` | — | 15 value classes | all widths | 15 classes over two lines needs 8 per line. Not a measurement — a counting argument. |
| `capacity` formula | `measured` | 4 widths | lacquer, root 16px | 320-430 | Its residual is `rowChrome`'s 0.04px. |
| `fanHeight` model | `held-out` | 110 deals, descending | inner 390x664, lacquer, timed, staged | bins with expected count >= 5, up to 316.0px, i.e. **s <= 9** | Pre-registered in `docs/research/prereg-descending-holdout.md`; all three criteria passed; 9.09% [5.0, 15.9]. **Above s=9 the model is extrapolation.** |
| `fanHeight` model | `measured` | 120 deals, ascending | same cell | same | 9.17% [5.2, 15.7]. |
| `T(w)`, `margin(s,w)` | `modelled` | — | reference cell, following state | derived from rows above | Width-independent. Their accuracy is the accuracy of `deskMinusCard` and `kMinusCard`. |
| `R(0)` at cardW 48.15, width 360 | `modelled` | 200,000 simulated deals | inner 360x664, lacquer, timed, following, capacity 8, ascending | not measured in a browser | **1.78% modelled.** The counterfactual card size has never been rendered at n. |
| `R(0)` at cardW 48.15, width 390 | `modelled` | 200,000 simulated deals | inner 390x664, capacity 9 | not measured in a browser | **1.31% modelled**, against 7.65% modelled at today's card in the same cell. |
| span change at 390 | `measured` | 12 deals, same-hand intervention | inner 390x664, lacquer, zh-Hant, timed, one card staged | that cell | **-20.8px mean** (-15.4 to -22.0). Control drift 0px on 12/12. Joker staged on 6/12. Worst deficit -14.3px -> -36.3px. |
| span change at 430 | `measured` | 12 deals, same-hand intervention | inner 430x664, same otherwise | that cell | **-70.4px mean** (-46.8 to -107.7); **8 of 12 deals go infeasible -> feasible**; worst deficit +30.9px -> -36.3px. Joker staged on 10/12. |
| span change at 360 | `measured` | 12 deals, same-hand intervention | inner 360x664, same otherwise | that cell | **+19.1px mean — worse, not better** (+8.1 to +71.3). The constant is LARGER than today's clamp below width 370.4. Worst slack 48.1px -> 16.1px, still feasible on 12/12. |
| span change at 390x748 | `measured` | 12 deals, same-hand intervention | inner 390x748, same otherwise | that cell | -20.4px mean, 12/12 feasible in both arms. Joker staged on 9/12. |
| desktop unchanged | `measured` | 6 deals, same-hand intervention | inner 1366x681 | that cell | **0.00px on 6/6.** Above the breakpoint the two arms are the same CSS, so this cell is a CONTROL on the media query rather than a measurement of an effect. |
| containment | `measured` | 30 probes, 5,260 element boxes, joker staged on 10 | 360/375/390/430x664 and 720x900, lacquer, zh-Hant, untimed | those cells | Clean. |
| desk title not truncated | `measured` | 3 viewports x 3 locales, titles counted per run | 360/390/430x664, lacquer, untimed | zh-Hant, en, zh-Hans | Clean at every locale. A RENDERED assertion (scrollWidth vs clientWidth), not a CSS pin: nowrap turns a wrap into a silent ellipsis, which moves no layout figure at all. |
| capacity at 320 | `measured` | 5 probes | inner 320x664 | that cell | **7, below the floor.** The detector fires. This is the width the constant withdraws. |

## A measurement that was taken and discarded

The first same-hand intervention run of this round produced these, and **they are void**:

| figure, as first measured | superseded by |
|---|---|
| -30.6px mean span change at 390x664 | -20.8px |
| 5 of 12 deals infeasible -> feasible at 430x664 | 8 of 12 |
| worst deficit -88px at 430x664 after | -36.3px |

They were measured against an intermediate state in which
the card box had been changed but the eight other sites that compute overlaps from the card
width had not, so the columns were positioned at one width and drawn at another — a layout
that ships nowhere. The tell was inside a gate that PASSED: the containment probe printed a
pitch of 35 where 0.7 x 48.15 = 33.7, and a plausible number in a green run was read
straight past. The rows above are from the re-run after the nine sites were collapsed to one
declaration. See METHODOLOGY practice 34.

## What is NOT validated, stated so it is not quoted as if it were

- **The elder-legibility question.** No session has been run. Nothing in this file says the
  shipped card is legible to anyone; it says what it costs in pixels. See `CURRENT.md`.
- **Any figure at a deck theme other than lacquer.** `stripW` differs by a factor of two.
- **Any figure at a root font-size other than the default**, except `glyphCap`, which is
  the one row measured across a ramp:

  | quantity | root font-sizes it was measured at |
  |---|---|
  | `glyphCap` and the card ink | 12px, 14px, 16px, 18px, 20px, 24px |
  | everything else in this file | 16px only |
- **The model above s=9.** The held-out test validated bins with expected count >= 5. The
  gate uses the bin INDEX for exactly this reason, rather than a probability from the tail.
- **`R` at any width in a browser.** Every `R` in this file is simulated. What is measured
  is the SPAN, by intervention.
