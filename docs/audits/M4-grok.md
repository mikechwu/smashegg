# M4 audit — Grok (game-agnosticism / version-skew / i18n+picker+chooser)

Archived 2026-07-14. Prompt: question-first, anchoring-free.

# M4 audit (read-only) — Grok

Scope: timing-class game-agnosticism, version-skew path, chooser + timing i18n. No files modified; no web search.

---

## Findings

### 1. Medium — Manual deploy scripts can ship permanent client `'dev'` while the Worker advertises a real SHA (skew signal never fires)

**Location:** `package.json:9-16`, `vite.config.ts:16-18`, `src/client/version.ts:45-52`, contrast `.github/workflows/deploy.yml:33-56`

**Failure scenario:** Operator runs the natural local production path:

```bash
npm run build && npm run deploy
```

- `build` bakes `__BUILD_VERSION__ = 'dev'` (`vite.config.ts:17` when `process.env.BUILD_VERSION` is unset).
- `deploy` only injects the Worker side: `--var BUILD_VERSION:$(git rev-parse HEAD)` (`package.json:16`).
- Assets in `dist/client` still say `'dev'`; `welcome.build` / `/api/health` say the git SHA (`game-room.ts:756`, `index.ts:80`).
- `updateAvailable()` requires **both** sides non-`'dev'` (`version.ts:48-50`) → banner never appears for any subsequent real deploy either, as long as the client bundle remains the `'dev'` build.

**Class:** (b) real skew never fires, beyond the stale-socket case — here because the **client is stuck on the dev sentinel**.

**Design vs implementation:** CI design is correct (same `${{ github.sha }}` on vite build env and wrangler-action vars, plus health smoke). The hole is the **package.json script surface**, not `deploy.yml`. `build:release` (`package.json:10`) exists but is not what `deploy` depends on.

---

### 2. Low — Wild terminology: chooser says 配牌; rest of UI says 逢人配

**Location:**

| Key | zh-Hans / zh-Hant |
|-----|-------------------|
| `game.card.wild` | 逢人配 (`zh-Hans.json:110`, `zh-Hant.json:110`) |
| `game.chooser.becomes` | 配牌当 / 配牌當 (`:164`) |
| `game.chooser.becomesBoth` | 两张配牌当 / 兩張配牌當 (`:165`) |

**Failure scenario:** Screen reader announces “配牌当 9♥” while the visible card badge and other wild copy use 逢人配 / 配. Same concept, two product terms.

**Class:** Implementation i18n consistency (not a design/platform issue). No mixed-script leakage between Hans/Hant on these keys; 繁/简 splits elsewhere look correct.

---

### 3. Low — “Planning time” label can sit on a disconnect-grace countdown

**Location:** `src/server/room-helpers.ts:144,210` (grace rows stamped with current `timingClass`); `src/client/table/SeatPlate.tsx:81-85` (shows `table.deadline.planning` whenever `planning && seconds !== null`)

**Failure scenario:** Room is `untimed` (or grace is tighter than remaining planning budget); opening lead is `planning`; expected actor disconnects. Wire still carries `timingClass: 'planning'`; plate shows **起手思考 / Planning time** over a **60s grace** clock (`DISCONNECT_GRACE_MS = 60_000` at `room-helpers.ts:70`), not `planningMs`.

**Class:** Spans design vs UX. Design treats `timingClass` as decision-point vocabulary (not budget source). UX can still read the label as “you have the planning window.”

---

## CHECKED-CLEAN

### 1. Game-agnosticism (room layer + engine hook)

**Room layer — no Guandan knowledge smuggled**

| Surface | What was checked | Result |
|---------|------------------|--------|
| Imports | `game-room.ts:6-13` — protocol / games registry / timing / core / room-helpers only | No `engine/guandan` or `engine/guess-number` |
| Config | `game-room.ts:493-527`, `index.ts:42-45` — `config` opaque; only `gameId` + `timing` validated | Clean |
| Seats | Loops use `game.maxSeats` / `game.minSeats` (`game-room.ts:439,839,999-1000`) | No hardcoded “4 seats” in DO |
| TimingClass use | `timeoutMsFor` (`timing.ts:72-74`): closed-union field map only | Opaque label → ms |
| Wire/DB class | `toWireDeadlines` / `applyNextDeadlines` only accept `'turn' \| 'planning'` as platform vocabulary (`room-helpers.ts:238-239`, `game-room.ts:1325-1326`) | Not Guandan phase logic |
| Comments only | Mentions of “Guandan hand” in `game-room.ts:12-13` | Doc, not code branch |

**Engine `timingClass` (Guandan) — 108 / opening-lead predicate**

```611:631:src/engine/guandan/index.ts
  timingClass(state) {
    // ...
    const t = state.trick;
    const held =
      state.hands[0].length + state.hands[1].length + state.hands[2].length + state.hands[3].length;
    return state.phase === 'playing' && t !== null && t.top === null && held === 108
      ? 'planning'
      : 'turn';
  },
```

| Path | Why 108 + top-null holds / fails correctly |
|------|--------------------------------------------|
| Hand 1 | `startHand` deals 4×27, enters `playing` with `startTrick` (`index.ts:212-231`); no tribute |
| Tribute `none` / `anti` | Same: `playing` + trick, cards only moved or untouched (`index.ts:237-241`); `moveCards` conserves total (`tribute.ts:271-278`) |
| Post-return | `returnTribute` resolve → `playing` + `startTrick` on same hands (`index.ts:494-503`); still 108 until first `play` |
| Optional anti decision | Phase `antiTributeDecision` → `'turn'` (not `playing`) |
| Tribute / return phases | Phase ≠ `playing` → `'turn'` (forced small sets by design comment `index.ts:623-625`) |
| Mid-hand new trick lead | `top === null` but `held < 108` after first play → `'turn'` |
| Seat count | Guandan `minSeats = maxSeats = 4` (`index.ts:343-347`); hardcoding hands[0..3] is engine-local, not room-layer |
| Rule variants (`config.ts`) | No variant changes deal size; `tributeLevelBasis: 'previousLevel'` throws at runtime elsewhere, does not invent a non-108 open |

Independent pin: obligations property test asserts `'planning' ⇔ phase playing ∧ noPlayYetThisHand` (`obligations.property.test.ts:112-119`), with `noPlayYet` driven by `handStarted`/`played` events (`:122-129`), not by reusing the 108 expression.

**Guess-number default path**

- Method omitted (`guess-number/index.ts` has `actionTimeoutMs` only; pin at `guess-number.test.ts:250-255`).
- Sole DO resolution: `resolveTimingClass` → `game.timingClass?.(state) ?? 'turn'` (`room-helpers.ts:85-86`).
- Call sites: `resolveTimeoutMs` (`:101`) and `applyNextDeadlines` (`game-room.ts:1332`). No direct `game.timingClass` elsewhere in server.
- Unit coverage of omitted method → `'turn'` and room preset budgets: `room-helpers.test.ts:360-366,355-357`.

---

### 2. Version-skew path

| Check | Evidence | Result |
|-------|----------|--------|
| Vite define | `vite.config.ts:16-18`, `build-version.d.ts:1-4`, `version.ts:11-12` | Client build identity |
| Welcome | `game-room.ts:754-756` → `store.ts:202` → `versionSignal` | Only on (re)connect |
| Health | `index.ts:79-81`, `protocol.ts:11-16` | Same `env.BUILD_VERSION ?? 'dev'` |
| CI equality | `deploy.yml:33-37` build env + `52-56` wrangler vars = `github.sha` | No same-deploy false banner on CI path |
| Smoke | `deploy.yml:58-77` asserts `jq .build == $GITHUB_SHA` with retries | Pins live Worker build |
| (a) Same-deploy false banner | CI: both sides same SHA by construction; no second injection source in `wrangler.jsonc` | Clean on primary path |
| (b) Missed skew | Documented: no welcome while socket never reconnects (`protocol.ts:115-120`). Extra ops hole is Finding 1 | Stale-socket OK; script hole called out |
| (c) `'dev'` both directions | `version.ts:48-50`; unit `version.test.ts:37-45` | Clean |
| (d) Dismiss re-show | Keyed by `serverBuild` (`version.ts:54-57`); unit `version.test.ts:53-68` | Second deploy re-shows |
| (e) Non-destructive | `App.tsx:25-45`: `role="status"`, reload only on button click, no modal; CSS flow banner (`app.css:133-144`), no input-blocking overlay | Clean |
| e2e wire contract | `version.e2e.test.ts:39-49` (`health` + `welcome.build`); restart under new build `:115-130` | Pins field + value; not banner UI (unit owns that) |

---

### 3. I18n + TimingPicker + Chooser

**Key parity (all three locales, 203 keys total)**

| Group | Count | Parity | Numbers vs `TIMING_PRESETS` |
|-------|-------|--------|-----------------------------|
| `lobby.timing.*` | 11 | Yes | fast 45/20, standard 90/45, relaxed 120/60; untimed 60s grace matches `DISCONNECT_GRACE_MS` |
| `table.deadline.planning` | 1 | Yes | — |
| `app.update*` | 3 | Yes | — |
| `game.chooser.*` | 6 (not only 3) | Yes | title, cancel, cannotBeat, becomes, becomesBoth, playedAs |

繁/简: differing keys use proper script pairs (载/載, 时/時, 标准/標準, etc.). No simp-only glyphs in Hant M4 strings / no trad-only in Hans. Shared identical strings (起手思考, 快棋, 取消) are script-neutral.

**TimingPicker** (`TimingPicker.tsx`)

| Behavior | Lines | Result |
|----------|-------|--------|
| Value match | `presetIdFor` field-for-field (`:56-67`); unit `timing-picker.test.ts` | Clean |
| Freeze | `disabled` prop; Lobby `:183` `room.status !== 'lobby'`; server `handleSetTiming` rejects non-lobby (`game-room.ts:950`) | Matches RulePicker authority |
| Legacy/null | `null` / non-preset → no pill + `lobby.timing.legacyHint` (`:109-110`) | Clean |
| Aria | `fieldset[disabled]`, `role="group"`, `aria-pressed`, `aria-label={legend}` (`:92-104`) | Same pattern as `RulePicker.tsx:281-292` |

**Chooser + visual-carries-meaning**

- Visible: chips `CardFace → GhostFace` (`ActionBar.tsx:226-234`), combo label via shared `comboKey` (`:237`), `cannotBeat` note (`:239-241`), title/cancel.
- `becomes` / `becomesBoth` / `playedAs` primarily in `optionAria` (`:56-77`) — if those three strings were missing, **faces + arrow still carry the substitution**; only a11y degrades.
- `t()` is typed on `keyof zh-Hant` (`i18n/index.ts:14,70-71`); no raw-key fallback path; missing keys fail compile/parity, not silent key dump.
- Feed / well / chooser combo **names** share `comboKey` / `comboKeyForType` (`helpers.ts:522-544`; well `:47`; feed `:49`; chooser `:237`). No decl-type disagreement.
- Well shows **physical** cards post-play (`TrickWell.tsx:42-44`); chooser shows **substituted** ghosts for wilds — intentional (table vs declaration), not a label key mismatch. SF chooser adds `declRunText` for option disambiguation only (`helpers.ts:547-557`).

**Terminology consistency note:** only Finding 2 (配牌 vs 逢人配). Half-width commas in zh strings match pre-M4 style (e.g. `hello.alarmPending`).

---

## Summary

| Area | Findings | Verdict |
|------|----------|---------|
| Game-agnostic timing | **0** | Room layer clean; Guandan `planning` derivation sound across hand-open paths + variants; guess-number omission hits every DO call site |
| Version skew | **1 Medium** | CI/wire/banner/dismiss/`dev` suppression sound; manual `build`+`deploy` can kill the signal |
| I18n / picker / chooser | **1 Low + 1 Low UX** | Parity, preset numbers, picker freeze/aria, chooser visual meaning OK; 配牌 wording + planning-on-grace label |

**Highest practical risk:** Finding 1 — any deploy that is not the GitHub workflow (or an explicit `BUILD_VERSION=… vite build` paired with the same SHA on `wrangler deploy`) can leave production clients forever silent on updates.
