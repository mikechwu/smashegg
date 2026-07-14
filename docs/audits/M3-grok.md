# M3 Cross-Model Audit — Grok (turn-direction/seat-offset consistency sweep + rule-picker→config wiring)

Ran 2026-07-14 (grok headless). Anchoring-free; relayed verbatim.

Grok CLI invocation: `~/.grok/bin/grok --cwd /Users/mikechwu/Projects/smashegg --prompt-file /private/tmp/claude-501/-Users-mikechwu-Projects-smashegg/62320b85-3354-421a-9394-b537844cbe29/scratchpad/grok-audit-prompt.txt --permission-mode auto --disable-web-search --max-turns 120` — succeeded on first attempt, exit code 0, stderr empty.

Grok's report, verbatim:

---

I'll run a code+spec adversarial audit of turn-direction consistency and rule-picker→config wiring. Starting with the canonical seat convention and every seat-progression site you listed. Digging into engine seat walks, ceremony counting, and client rotation next. Checking one more partial-config / default-merge path and whether `turnDirection` appears anywhere else on the client.

# Adversarial correctness audit — turn-direction & rule-picker wiring

**Scope:** code + `docs/rules/guandan.md` only. No runtime tests executed.

**Canonical convention:** `nextSeat(seat, config)` in `src/engine/guandan/types.ts`:
- `counterclockwise` → `(seat + 1) % 4` (default)
- `clockwise` → `(seat + 3) % 4`
- 下家 = that next seat; partners remain `(seat + 2) % 4` (direction-independent)

---

## FINDINGS

### F1 — **Major** — Engine `init` does not default-merge config; missing `turnDirection` silently becomes clockwise

**Where:** `GuandanGame.init` (`index.ts`) uses the opaque room config as-is. `nextSeat` only treats the **exact** string `'counterclockwise'` as CCW:

```ts
// 26:28:src/engine/guandan/types.ts
export function nextSeat(seat: Seat, config: RuleVariant): Seat {
  return config.turnDirection === 'counterclockwise' ? (seat + 1) % 4 : (seat + 3) % 4;
}
```

**Failing scenario:** foreign/old client (or hand-crafted `setConfig`) stores a **partial** object, e.g. `{}` or `{ firstLeadMethod: 'drawCard' }` without `turnDirection`.

| Path | Behavior |
|------|----------|
| Engine | `turnDirection === undefined` → **clockwise** branch for every walk (tricks, tribute seatOrder, ceremony count) |
| Spec default | `counterclockwise` |
| Client `asRuleVariant` | merges `{ ...JIANGSU_OFFICIAL_ONLINE, ...partial }` → CCW for local classification only |

Server still runs; no `config.notImplemented` throw. Turn order, equal-tribute seatOrder, and ceremony counting all invert relative to the owner default.

**Contrast:** client helpers merge defaults; engine and room layer do not. Room create/`setConfig` are intentionally opaque (PLAN §4), so incomplete payloads are live until start.

**Not a bug for:** full `assembleConfig(...)` / `JIANGSU_OFFICIAL_ONLINE` configs (normal HomePage + RulePicker path).

---

### F2 — **Minor** — `fixedSeat` is mis-grouped with init-guarded values; checklist "init-rejected" does not match spec/engine

**Spec §10 (guarded = not implemented):** only
1. `equalTributeAssignment: 'winnersChoose'`
2. `tributeLevelBasis: 'previousLevel'`
3. `levelTrack: 'shared'` **and** `aFailConsequence: 'demote'`

**`firstLeadMethod: 'fixedSeat'`** is a real VARIANT, **implemented** (leader seat 0, no ceremony; `ceremony.test.ts` asserts this). Init does **not** reject it.

RulePicker comments/tests call it "guarded" next to the three notImplemented values. That overstates the product guard:

| Claim | Result |
|-------|--------|
| Unreachable from curated UI | **Yes** (only `drawCard` \| `random`) |
| Init-rejected if injected | **No** — starts successfully |
| Spec-allowed | **Yes** |

If the audit bar requires init-reject for `fixedSeat`, that bar conflicts with the rules table and the engine. Treat as **labeling/docs inconsistency**, not an engine hole (unless product intent is to ban fixed seat entirely).

---

### F3 — **Minor** — Ceremony JSDoc hardcodes "COUNTERCLOCKWISE" while code follows `turnDirection`

**Where:** `types.ts` `handStarted.ceremony` docs (`firstDrawer: counting … COUNTERCLOCKWISE`, "next CCW").

**Code:** `stepSeats` → `nextSeat` with config (`index.ts`); clockwise covered by `ceremony.test.ts`.

Docs lag implementation. STATUS prose also pins "CCW" in places where the engine is direction-aware. No runtime effect.

---

### F4 — **Minor** — Foreign non-curated values: picker **display** ≠ live room config until any edit

**By design** for degradation (`picksFromConfig` falls back per field), but it breaks a strict reading of "displayed picks always equal what would be sent / started with":

| Room config | UI shows | Start without edit |
|-------------|----------|--------------------|
| `firstLeadMethod: 'fixedSeat'` | `drawCard` | **fixedSeat** (seat 0 leads) |
| `cardCountVisibility: 'onRequestLE6'` | `always` | **onRequestLE6** (engine threshold 6) |

Any picker change runs `assembleConfig({ ...displayedPicks })` → rewrites full profile from owner defaults + curated picks (non-curated keys restored to `JIANGSU_OFFICIAL_ONLINE`). Safe on **write**; misleading on **read-only** lobby.

---

## CHECKED, NO FINDING

### (1) Turn-direction / seat-offset sweep

| Site | Verdict |
|------|---------|
| **`nextSeat` / `partnerOf`** | Single convention; partner across table is correct for both directions. |
| **`trick.ts`** | `nextActiveSeat`, `stepToward`, `resolveWinnerAndLead` all take `config` and use `nextSeat`. `jiefengRecipient: 'nextPlayer'` → `nextActiveSeat` (direction-aware). |
| **`tribute.ts` equal `seatOrder`** | Walk from 头游 via `nextSeat` until first payer — matches §7.3 / tests for CCW and CW. |
| **`tribute.ts` obligations** | From finish order / teams only; no hardcoded `(seat+1)%4`. Loser order for 双上 does not depend on turn direction (assignment is by rank / seatOrder walk). |
| **`index.ts` ceremony** | `countingValue`: A=1, else `naturalValue` → J=11,Q=12,K=13. `firstDrawer = stepSeats(cutter, (count−1)%4, config)`. `markerSeat = stepSeats(firstDrawer, U{0..3}, config)`. Uniform over seats under both directions. |
| **`index.ts` hand-1 leaders** | `random` / `drawCard` / fall-through `fixedSeat`→0; no direction bug. |
| **`levels.ts` `partnerOf`** | Team scoring only; independent of turn direction. |
| **`guess-number`** | Hardcoded `(seat+1) % seats`. Separate game, no `turnDirection`. **N/A** for guandan flip coherence. |
| **Client `seatLayout` / SeatPlates** | Hardcoded `east = viewer+1`, `west = viewer+3` is **geometry of abstract seat indices**, not a second rotation policy. Under default numbering, +1 is the CCW neighbor (east of south), +3 the CW neighbor (west). Engine CW (`next = +3`) lights west first → physical clockwise path; CCW lights east first → physical CCW. **Clockwise config does not need a layout flip** for plate order to stay coherent with engine rotation. `GameTable` uses `seatLayout(activeSeat)` only; no second hardcoded progression. Ceremony overlay uses event seats by name, does not re-count. |

No guandan site was found that hardcodes `(seat+1)%4` for **turn progression** outside `nextSeat` itself (CCW branch).

---

### (2) Rule-picker → config wiring

| Check | Verdict |
|-------|---------|
| **Picker options → keys** | Six curated keys only: `firstLeadMethod`, `aFailConsequence`, `overshootWinsGame`, `returnTributeMaxRank`, `cardCountVisibility`, `jokerBombSupreme`. Values match `RuleVariant` unions (subset of allowed enums). |
| **`assembleConfig`** | `{ ...JIANGSU_OFFICIAL_ONLINE, ...picks }` — untouched keys stay owner defaults. |
| **`CURATED_DEFAULT_PICKS` / HomePage** | Owner profile + product `firstLeadMethod: 'drawCard'` (engine default remains `random`). Matches comments/tests. |
| **Displayed ↔ sent (happy path)** | `set(key)` → `onChange(assembleConfig({...picks, [key]}))`; round-trip `picksFromConfig(assembleConfig(picks))` holds for curated values. |
| **`game-room` setConfig / start** | Opaque JSON store; `init` throws → `room.startFailed`, lobby retained. |
| **Init guards (true three)** | `winnersChoose`, `previousLevel`, `shared+demote` throw `config.notImplemented` at init. Unreachable via `assembleConfig` (levelTrack never curated; equalTribute/tributeLevelBasis never curated). |
| **UI unreachability** | `fixedSeat`, `winnersChoose`, `previousLevel`, `onRequestLE6`, `turnDirection: clockwise`, etc. not offered. |
| **Foreign full config** | Non-curated keys persist until edit; start uses them (except the three init rejects). On edit, re-assembly snaps to owner + curated picks. |
| **`aFailConsequence: demote` alone** | Allowed in UI and engine (`levelTrack` stays `perTeam`). |

---

## Could-not-verify (code/spec only)

- Runtime/network injection of partial configs against a live DO (logic is clear from static code; not exercised here).
- Visual "feels like 下家 on the right" under CW for every locale/layout CSS path beyond `seatLayout` math (plates use that helper only).
- Whether product owners **want** `fixedSeat` banned at init (spec says implement; picker prose says "guarded").

---

## Severity summary

| ID | Severity | One-liner |
|----|----------|-----------|
| F1 | **Major** | Partial/missing `turnDirection` → engine rotates **clockwise** (default is CCW); no init merge. |
| F2 | **Minor** | `fixedSeat` labeled like notImplemented guards but is implemented and accepted. |
| F3 | **Minor** | Ceremony type docs say CCW-only; code is `turnDirection`-aware. |
| F4 | **Minor** | Foreign non-curated values: UI display ≠ room/start config until edit. |

**Bottom line on the flip sweep:** with a **complete** `RuleVariant`, engine seat-progression sites (trick, tribute seatOrder, ceremony, jiefeng-next, levels partners) are coherent under both `turnDirection` values. Client plate layout is fixed index geometry that matches both engine branches. The material risk is **incomplete configs**, not a hardcoded `(seat+1)%4` island inside guandan turn logic.

**Bottom line on picker wiring:** curated path is consistent (create = display = send). The three real init guards are UI-unreachable and init-rejected. `fixedSeat` is UI-unreachable but **not** init-rejected (correct per rules table).

---

Raw output preserved at /private/tmp/claude-501/-Users-mikechwu-Projects-smashegg/62320b85-3354-421a-9394-b537844cbe29/scratchpad/grok-out.txt; prompt file at .../grok-audit-prompt.txt.