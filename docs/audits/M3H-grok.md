# M3-hardening Cross-Model Audit — Grok (i18n/locale-default + sort consistency + §2 e2e path-coverage claims)

Ran 2026-07-14 (grok headless). Anchoring-free; relayed verbatim.

Grok completed the audit in a single invocation (exit code 0). Here is grok's report verbatim:

---

# Adversarial audit (code only)

## FINDINGS

### Major

**M1 — Tests 4/5 can go green while proving less than their titles claim**
`tests/e2e/product-paths.e2e.test.ts`

- Titles: `"anti-tribute over the full wire stack"` / `"suspension over the full wire stack"`.
- Phase A (engine seed scan) is **hard-required** (`expect(engineProof).not.toBeNull()` / `expect(engineSeed).not.toBeNull()`).
- Phase B (wire hunt) is **optional**: if `hunt.progress === null`, the test still **passes** and only appends a proof note.
- Reduced proof is only visible in `console.log` `PROOF-LEVEL SUMMARY` in `afterAll` — **not** a failing assertion and easy to miss in CI.

**Failing scenario (silent under-proof):** wire hunt exhausts (deadline/roomsCap); vitest stays green; only engine mechanics were proven; transport of `antiTribute` / suspension views over the real room socket was not. The file header admits this; the test names and pass/fail gate do not enforce it.

**M2 — Same pattern on test 3 (weaker title, same mechanism)**
Wild test can complete via `ENGINE-CONSTRUCTED fallback` after wire hunt fails (`expect(ran).toBe(true)` only). Client `matchSelection` is still exercised (honest for that claim); **wire transport of the chosen decl is not always proven**. Title does not say "wire stack," so lower severity than M1, but same "green while proving less" risk.

---

### Minor

**m1 — Event feed can mix locales after a mid-session language switch**
`GameTable.foldEvents` bakes already-translated strings into params at event time:

- `combo: \`${t(comboKey(...))} ...\``
- `place: t(placeKey(...))`
- `card: cardLabel(...)` (calls `t()` inside)

`EventFeed` then does `t(line.key, line.params)`. Template keys re-localize on switch; baked params do not → mixed zh-Hant/zh-Hans/en fragments in history. Chrome UI and fresh `t()` call sites stay consistent. Not a raw-key path.

**m2 — `detectLocale` ignores `navigator.language`**
Only `navigator.languages` is read. If `languages` is empty/`undefined` but `navigator.language` is set (odd environments), falls straight to `DEFAULT_LOCALE` (`zh-Hant`) instead of mapping. Uncommon; first-match logic itself is sound when `languages` is populated.

**m3 — Regional gaps outside the claimed map**
`zh-MO` (Macau, traditionally Hant) falls through to bare `zh` → **zh-Hans**. Claimed TW/HK/Hant vs CN/SG/Hans/bare-zh mapping is correct; MO is unlisted.

**m4 — Claimed chain "saved > detected > zh-Hant > en" overstates the last step**
Actual resolution:

1. Valid `localStorage` `locale` (if any)
2. Else first matching `navigator.languages` tag
3. Else `DEFAULT_LOCALE` = `zh-Hant`

There is **no** automatic "zh-Hant then en" for detection or for missing strings. `t()` indexes `translations[currentLocale][key]` only — no en string fallback, no key-as-fallback. With compile-time keys + parity tests, this is fine; the "> en" leg is not implemented as a safety net.

---

### Not elevated to findings (checked, clean)

- No path that **serves raw keys** under normal data (missing key would yield `undefined`, not the key; parity prevents that).
- Sort pref does not touch room/server state.
- Hand selection indices stay identity-stable across sort toggle.

---

## (1) i18n / locale-default

### CHECKED, NO FINDING

| Claim | Verdict |
|--------|---------|
| Fallback chain prevents raw keys / mixed primary UI | **Hold** for chrome: one `currentLocale`, all `t()` from that bag; parity 188 keys, non-empty strings |
| TW/HK/Hant → zh-Hant; CN/SG/Hans/bare-zh → zh-Hans; first-match-wins | **Hold** (`LOCALE_TAG_MAP` most-specific first; languages list first hit wins; tests cover) |
| zh-Hans key parity | **Hold** (same keys as zh-Hant/en; unit test) |
| Guandan terms (tribute/return tribute/anti-tribute/jiefeng/the wild rule/1st finisher/4th finisher) | **Hold** — correct simplified forms; the wild rule shared (no trad residue) |
| No Taiwan-isms leaking through conversion | **Hold** on spot-check (connection term localized, endpoint term localized, nickname, default, table surface, loading, …); only intentional trad is `locale.zhHant` = `Traditional Chinese self-label` |
| Semantic siblings vs en | **Hold** on audited game/UI keys; param tokens aligned across three files |
| `<html lang>` updates | **Hold** — `App` `useEffect` sets `document.documentElement.lang = locale`; static `index.html` `lang="zh-Hant"` is pre-hydrate default |

### Notes (not fail)

- Saved choice overrides detection (`readStoredLocale` → `isLocale` → else `detectLocale`).
- Invalid stored values fall through to detection, not mixed bags.

---

## (2) Sort-order consistency

### CHECKED, NO FINDING

| Claim | Verdict |
|--------|---------|
| `descending` is exact reverse of ascending display | **Hold** — `order = hand.map((_,i)=>i); if (descending) order.reverse()`; no second comparator |
| Selection indices stable across toggle | **Hold** — `selected` / `onToggle(i)` / `selected.has(i)` use original `hand` indices; toggle does not clear selection (`handKey` ignores sort pref) |
| Pref never leaks to room/server | **Hold** — `localStorage` key `pref:handSort` only in `GameTable`; server has zero references |
| Toggle localized in all three locales | **Hold** — `game.sort.label` / `.ascending` / `.descending` present and non-empty in zh-Hant, zh-Hans, en |

Unit tests in `table.test.ts` pin reverse + index stability at the same arithmetic HandFan uses. Engine `sortCards` remains the sole ordering; UI only reverses display indices.

**could-not-verify:** visual layout of two-row fan after reverse (no DOM e2e for the toggle); logic is a pure index reverse then `splitIndexRows`.

---

## (3) §2 path-coverage claims (`product-paths.e2e.test.ts`)

| Test | Claim | Honest? | Silent under-proof? |
|------|--------|---------|---------------------|
| 1 UI-default creation | Real UI payload: `assembleConfig` + `CURATED_DEFAULT_PICKS` + `DEFAULT_GAME_ID` from client modules | **Yes** — same expression as `HomePage.handleCreate` (not re-typed constants) | No |
| 1 config:null | Start fails `room.startFailed`, room **stays lobby**, config stays null | **Yes** — asserts status + config; server `game-room` keeps lobby on init throw | No |
| 2 created defaults | Room A config = curated assembly; `firstLeadMethod: 'drawCard'`; ceremony on first `handStarted` | **Yes** (depends on test 1 ordering) | No |
| 3 wild multi-interp | Client's own `matchSelection` (+ `declSignature` / `sameMultiset`) | **Yes** for selection machinery | **Yes for wire** — engine fallback still greens (M2) |
| 4 anti-tribute | "Full wire stack" | **Partial** — engine always; wire optional | **Yes** (M1) |
| 5 suspension | "Full wire stack" + clear | **Partial** — engine always includes clear; wire may prove suspension only, clear chase optional | **Yes** (M1) |

### Extra honesty checks

- **UI-literal import:** real runtime import of `RulePicker` (`@ts-expect-error` for JSX under scripts tsconfig); cast only for typing — not a hand-rolled config object. **Hold.**
- **config:null:** `expect(info.status).toBe('lobby')` and `expect(info.config).toBeNull()` — not merely "rejected." **Hold.**
- **wild uses `matchSelection`:** yes; scenario finder `wildTwoPairSelection` is test scaffolding (acceptable for driving the client matcher).
- **Wire-vs-engine proof notes:** wording is honest when read; **vitest pass/fail is not.** That is the core §2 integrity gap.

---

## Summary table

| Area | Blockers | Majors | Minors |
|------|----------|--------|--------|
| i18n / locale-default | 0 | 0 | m1 feed mix, m2 `language`, m3 MO, m4 chain wording |
| Sort-order | 0 | 0 | 0 |
| §2 e2e path coverage | 0 | M1 titles 4/5 wire optional; M2 test3 wire optional | — |

**Bottom line:** i18n fallback/mapping/parity/Guandan wording and hand-sort reverse+selection+pref isolation look solid. The sharp adversarial hit is **§2 e2e**: rare-path (and wild) tests document engine fallback honestly in comments/`proofNotes`, but **can pass without the wire-level proof their titles advertise**, and CI green does not force full claimed path coverage.

---

Invocation: `~/.grok/bin/grok --cwd /Users/mikechwu/Projects/smashegg --prompt-file /private/tmp/claude-501/-Users-mikechwu-Projects-smashegg/62320b85-3354-421a-9394-b537844cbe29/scratchpad/grok-audit-prompt.txt --permission-mode auto --disable-web-search --max-turns 120` — succeeded on attempt 1 of 3, exit code 0.