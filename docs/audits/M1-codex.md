# M1 Cross-Model Audit — Codex (primary lineage: wilds + tribute; spot-check: levels/beats)

Ran 2026-07-14 against engine commit (M1 gate). Anchoring-free: Codex received the spec + code only.

**FINDINGS**

- **major — `tributeLevelBasis: 'previousLevel'` is ignored.**  
  Spec §7.2 says tribute rank uses the configured level basis, default upcoming, with `previousLevel` as a valid variant; §10 lists `tributeLevelBasis` (`docs/rules/guandan.md:186`, `:264`). `src/engine/guandan/index.ts:startHand` always calls `setupTribute(prevFinishOrder, hands, level, config)` with the newly selected upcoming level (`index.ts:118`), and `src/engine/guandan/tribute.ts:eligibleTributeCards` computes forced rank from only that level (`tribute.ts:216-223`).  
  Failing scenario: previous hand was played at level `5`; team 0 wins 1-2 and advances to upcoming level `8`; config sets `tributeLevelBasis: 'previousLevel'`. P1 owes tribute and newly holds `['8S','AS','5H','4C', ...]` with no anti-tribute. Under previous level `5`, `5H` is wild/excluded and `AS` is forced. The engine uses level `8`, elevates `8S` to 15, and rejects paying `AS` as ineligible while forcing `8S`.

- **major — `equalTributeAssignment: 'winnersChoose'` is a spec-listed variant but is unusable.**  
  Spec §7.3 allows `seatOrder | random | winnersChoose` (`docs/rules/guandan.md:187`) and §10 lists `winnersChoose` as an allowed config value (`:265`). `src/engine/guandan/index.ts:init` throws immediately for this config (`index.ts:231-235`), and `src/engine/guandan/tribute.ts:applyPayTribute` returns `config.notImplemented` if reached (`tribute.ts:357-366`).  
  Failing scenario: config `equalTributeAssignment: 'winnersChoose'`, previous finish order `[0,2]` (double tribute), P1 and P3 both pay equal-value Aces at level `2`. Spec requires the winners to choose which payer’s card goes to 头游; the engine cannot start the match with that config, or rejects resolution if called directly.

**CHECKED, NO FINDING**

- `src/engine/guandan/combos.ts:validatePlay`: wildcard substitution template matching, standalone wild single/pair, wild cannot represent jokers, mixed joker pair rejection, joker bomb exactness, five-of-a-kind full-house guard, §3.8 natural suited-straight guard, straight-flush wild handling, A-low/A-high windows, and level-card natural sequence position.
- `src/engine/guandan/generate.ts:legalPlays`: rank groups and sub-multisets, joker singles/pairs/bomb, straight/tube/plate windows, straight flush dedupe by suit-blind projection, wild-completed plain straight/SF ambiguity, and level-rank bomb cap by counts.
- `src/engine/guandan/combos.ts:beats`: strict comparison, equal never beats, bomb-vs-non-bomb, straight flush between 5- and 6-bombs, same-size bomb level elevation, joker bomb supremacy default.
- `src/engine/guandan/tribute.ts`: default/upcoming-level tribute eligibility, forced rank with concrete-card choice, wild exclusion, non-heart level inclusion, return eligibility `levelValue <= 10`, fallback lowest-card set, anti-tribute auto/optional condition and reveal set, double-tribute staging, seatOrder/random equal assignment, corresponding returns, and leader derivation.
- Spot-check: `src/engine/guandan/levels.ts:selectCurrentLevel` and default A-win condition in `applyHandResult` matched §1.5/§6.4 for the default rules.

**COULD NOT VERIFY**

- I did not run the test suite; this was a read-only static/code-path audit. No additional suspected defects are being withheld as unverified.

Codex session ID: 019f5ed0-ad56-7f01-bfb1-d3c3a9f6b5ac
Resume in Codex: codex resume 019f5ed0-ad56-7f01-bfb1-d3c3a9f6b5ac
