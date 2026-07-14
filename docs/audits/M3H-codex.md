# M3-hardening Cross-Model Audit — Codex (wild-disambiguation algorithm)

Ran 2026-07-14. Anchoring-free. Note: Codex's sandbox blocked test EXECUTION (EPERM on vite temp) — findings are reasoned-only from source; our own CI executes the same suites green.

**1. FINDINGS**

No correctness findings in the new wild-card selection-disambiguation layer.

**2. CHECKED, NO FINDING**

- `validatePlay` one-suit-naturals suppression: verified by source that `straight` validation rejects one-suit naturals when `allowUnderDeclareStraightFlush=false` after rank-window inclusion, while mixed-suit naturals remain legal. Spec: `docs/rules/guandan.md:126`, `:134`, `:236`. Code: `src/engine/guandan/combos.ts:323-341`. Reasoned-only; test execution blocked.
- `classifyPlays` offered-set path: verified it enumerates candidate forms through `validatePlay`, so the v1.4 suppression applies to classification and declaration inference. Code: `src/engine/guandan/combos.ts:423-477`, `:482-490`. Reasoned-only.
- Straight-flush demotion variant: verified `wildStraightFlushIsBomb=false` requires the correct `demoted` spelling and classifies demoted SFs separately from bomb SFs. Spec: `docs/rules/guandan.md:230`. Code: `src/engine/guandan/combos.ts:363-399`, `:499-507`, `:527-534`. Reasoned-only.
- Bomb ordering and `jokerBombSupreme=false`: verified comparator tiers put SF between 5- and 6-bombs, joker bomb above all by default, and between 7- and 8-bombs when `jokerBombSupreme=false`. Spec: `docs/rules/guandan.md:86-88`, `:270-271`. Code: `src/engine/guandan/combos.ts:537-607`. Reasoned-only.
- `legalPlays` vs `validatePlay`: verified both straight realization paths use the same suit-union predicate: one-suit in-window naturals suppress plain straight, any off-suit in-window copy is swapped in, and `allowUnderDeclareStraightFlush=true` restores straight emission. Code: `src/engine/guandan/generate.ts:177-190`, `:295-344`. Reasoned-only.
- `matchSelection`: verified it returns the full classified offered set and only marks `playable` by hint projection; it does not hide unplayable readings or introduce extra readings. Code: `src/client/table/helpers.ts:72-80`, `:117-138`. Reasoned-only.
- Test oracle independence: no circular reuse of `validatePlay`, `classifyPlays`, `sequenceWindow`, `legalPlays`, or `matchSelection` in the completeness oracle. It does share low-level card helpers and `compareComboStrength` for the ordering property, but its completeness classifier is a separate wild-substitution plus direct shape-check implementation. Code: `tests/unit/engine/wild-disambiguation.test.ts:44-50`, `:486-648`, `:750-767`. Reasoned-only.
- Design-doc corrections FH-9/SF-8: verified tests account for the Corrections section: FH-9 includes both `fullHouse-7` and `fullHouse-K`; SF-8 includes three SF windows. Design doc: `docs/research/wild-disambiguation.md:346-350`. Tests: `tests/unit/engine/wild-disambiguation.test.ts:172-177`, `:281-287`.

**3. COULD NOT VERIFY**

- Execution confirmation: `npx vitest run tests/unit/engine/wild-disambiguation.test.ts` failed before running tests because the read-only sandbox blocked Vite from writing `node_modules/.vite-temp/vitest.config.ts.timestamp-...mjs` (`EPERM`). Direct Node TypeScript import was also blocked by extensionless TS module resolution. No counterexamples were execution-confirmed.

Codex session ID: 019f6207-f92e-7202-8ede-4736945826ab
Resume in Codex: codex resume 019f6207-f92e-7202-8ede-4736945826ab
