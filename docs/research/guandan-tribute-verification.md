# Guandan (掼蛋) Disputed Rules Verification

**Primary authoritative source located:** 《竞技掼蛋竞赛规则（试行）》 (Competitive Guandan Rules, Trial), issued by 国家体育总局棋牌运动管理中心 (2022, formalized 2023; Huai'an/Jiangsu lineage). Full text of the tribute clause (第十条 贡牌与还牌) was retrieved verbatim from two independent copies ([sohu.com](https://www.sohu.com/a/621481154_121124679), [52hrtt.com](https://www.52hrtt.com/ny/n/w/info/F1702965842341)) which agree word-for-word. Key verbatim clauses used throughout:

> 单贡: 「从第二副牌开始，在出牌前，由上副牌的下游向上游进贡全手牌中最大的一张牌（红心级牌除外），上游选择全手牌中一张牌点不超过10的牌还给下游，如全手牌均大于10，则还最小的牌。首圈由下游领出牌。」
> 双贡: 「如上副牌出现双下，则双下方两名运动员均向对方进贡，称为双贡。上游选择牌点较大的牌，搭档选择牌点较小的牌，并对应还牌。若牌点相同，则按顺时针方向进贡，对应还牌。还牌时，将牌面向下，两位进贡者同时亮牌。还牌后，均由进贡给上游者首圈领出牌。」
> 抗贡: 「下游或双下方在进贡前抓到两个大王，则抗贡，不再贡牌，首圈由上游领出牌。」

---

## 1. Anti-tribute (抗贡): automatic vs optional

**Answer:** Automatic/mandatory in every source found. The condition (tributing side collectively holds both big jokers — 单下: sole payer holds both; 双下: one each or one player holds both) *triggers* 抗贡; no source describes a right to decline it and pay tribute anyway.

**Per-source findings:**
- Official trial rules: 「…则抗贡，不再贡牌」 — declarative, no choice ([sohu](https://www.sohu.com/a/621481154_121124679), [52hrtt](https://www.52hrtt.com/ny/n/w/info/F1702965842341)).
- [pagat.com](https://www.pagat.com/climbing/guan_dan.html): "if each of the opponents holds one red joker or one of the opponents holds two red jokers, **the tributes are cancelled**" — a condition, not an option.
- [zh.wikipedia.org](https://zh.wikipedia.org/zh-hans/%E6%8E%BC%E8%9B%8B): 「则**跳过**进贡步骤，称为'抗贡'」 — automatic skip.
- JJ帮助中心 ([jj.cn](https://www.jj.cn/news/320/20120613160600024346.shtml)) / 唐人游 ([guandan.uc55.com](https://guandan.uc55.com/Rule/Detail/201801_000209.html)): 「若末游玩家有两张大王，**可**抗贡，不用进贡」 — the 「可」 here is standard Chinese rule phrasing for entitlement ("qualifies for"), and both platforms auto-execute it (jokers auto-shown on screen); neither documents a decline flow.
- Explainer synthesis ([gameabc.com](https://www.gameabc.com/news/201903/5165.html), [zhihu](https://zhuanlan.zhihu.com/p/5480576176)): explicit that it is 强制性 — no "可以不抗贡" option exists in standard rules.
- **Disconfirming evidence sought:** targeted searches for 放弃抗贡 / 可以不抗贡 / 选择进贡 found nothing. Note the choice would be nearly always dominated anyway (paying would surrender a big joker), so a decline option has no constituency.

**Proposed default:** `antiTributeMode: 'auto'` (I found no evidence any platform implements `'optional'`; keep the enum only if you want future-proofing).
**Tag:** CORE.

## 2. Anti-tribute reveal scope

**Answer:** The two qualifying big jokers are shown publicly — including *which player holds which* — and nothing else is revealed. Mandatory reveal is explicit on platforms; the official trial-rule text itself does not spell out the reveal step (in physical play showing the jokers is the only way to prove entitlement, and referee practice requires it, but the retrieved clause text is silent).

**Per-source findings:**
- Official trial rules: 抗贡 clause contains no 亮牌 wording ([52hrtt](https://www.52hrtt.com/ny/n/w/info/F1702965842341)) — reveal is implied by verification need, not stated.
- JJ / 唐人游: 「抗贡的大王需在界面上**亮出**」 — the jokers are displayed in the UI, attributed to the holder(s) ([jj.cn](https://www.jj.cn/news/320/20120613160600024346.shtml), [guandan.uc55.com](https://guandan.uc55.com/Rule/Detail/201801_000209.html)).
- pagat.com: silent on showing.
- No source anywhere suggests revealing anything beyond the two big jokers.

**Proposed default:** reveal both big jokers with holder attribution to all four players; reveal nothing else.
**Tag:** CORE for "only the two big jokers, publicly"; UNCERTAIN only on whether official competitive text *mandates* the reveal (platform practice and physical necessity say yes; I could not retrieve an official sentence saying so).

## 3. Double-down (双下) tribute mechanics

**Answer:**
(a) Both payers each submit one tribute; submission is effectively simultaneous/independent (each payer's card is rank-forced anyway). The official text's explicit simultaneity wording attaches to the **return** step: returns are handed face-down and 「两位进贡者同时亮牌」 (both payers reveal simultaneously) — designed so neither returner sees the other's return first.
(b) Confirmed: 头游 (上游) receives the higher-ranked tribute, 二游 (partner) the lower — unanimous across official rules, Wikipedia, JJ, pagat.
(c) Equal rank: **this is where sources genuinely conflict.** Official rules: 「若牌点相同，则按顺时针方向进贡」; multiple Chinese explainers concretize this as the 头游's 下家 (next player in turn order) gives to 头游 — and the payer who gave to 头游 leads. 唐人游/JJ: equal tributes are allocated **randomly**, and whoever's card 头游 received leads. pagat.com: "the winners can decide between them which should take which card" and equal payers "agree between them who should play first." Lead rule in ALL versions: the payer whose tribute went to 头游 leads (official: 「均由进贡给上游者首圈领出牌」; pagat: higher-tribute payer leads).
(d) Confirmed: 「对应还牌」 — each receiver returns to the specific payer whose tribute card they took (pagat: "gives an unwanted card face up to the opponent **from whom they received tribute**"). (JJ's page has a garbled 「还给自己的下家」 sentence; the 对应 pairing is the standard and matches JJ's actual client behavior per explainers — treat the JJ page wording as low quality.)

**Per-source findings:** official text as quoted above ([sohu](https://www.sohu.com/a/621481154_121124679), [52hrtt](https://www.52hrtt.com/ny/n/w/info/F1702965842341)); [pagat.com](https://www.pagat.com/climbing/guan_dan.html); [163.com](https://www.163.com/dy/article/KI4HEOK50511CTRH.html) (「如贡牌同样大小，则执行'贡左还右'规则…规定上游的下一家先出牌」); [唐人游](https://guandan.uc55.com/Rule/Detail/201801_000209.html) (「若个用户进贡的牌一样大，用户还牌时随机进行分配」, 「进贡大者先出牌，若一样大则头游玩家拿到谁家贡出的牌，谁家先出」); [tcy365](https://www.tcy365.com/news/d30358.html).

**Proposed defaults:** simultaneous tribute submission; higher→头游 / lower→二游; on equal rank, assign 头游 the card from 头游's 下家 (official convention) with a config `equalTributeAssignment: 'seatOrder' | 'random' | 'winnersChoose'`; lead = the payer whose card went to 头游 (invariant, hard-code); return strictly to the paired payer (hard-code).
**Tag:** (a) CORE, (b) CORE, (c) VARIANT (official=seat-order, 唐人游=random, pagat=winners choose), (d) CORE.

## 4. Tribute card choice

**Answer:** The RANK is forced — highest card in the newly dealt hand, with heart-level cards (红桃级牌/逢人配) explicitly excluded and never tributable. Confirmed everywhere. When multiple cards tie at that highest rank, no official text addresses the copy choice; strategy literature assumes the **payer chooses which suit copy** to give (e.g., advice to pick the copy that minimizes the receiver's straight-flush potential), and no source says a specific copy is forced. Digital clients typically auto-select, which is consistent with "any copy is legal."

**Per-source findings:** official 「进贡全手牌中最大的一张牌（红心级牌除外）」 ([52hrtt](https://www.52hrtt.com/ny/n/w/info/F1702965842341)); [pagat.com](https://www.pagat.com/climbing/guan_dan.html) ("highest ranked single card other than a wild card, face up"); [zh.wikipedia](https://zh.wikipedia.org/zh-hans/%E6%8E%BC%E8%9B%8B) (红心级牌 excluded); suit-choice strategy discussion via search results referencing [gametea.net](https://www.gametea.net/ask/201904/8684.html) and SEU rules PDF ([ddgh.seu.edu.cn](https://ddgh.seu.edu.cn/_upload/article/files/44/c8/f455e1d04d2a998e40454931740a/4f853bb4-29b9-45dc-9c56-7627ed4c9726.pdf)). One search-result snippet claimed "赢家可以选择花色" (receiver picks the suit) — I could not corroborate this in any primary rule text; treat as noise/conflation with the pagat equal-tribute winners-choose variant.

**Proposed default:** rank forced (max levelValue, heart-level wilds excluded); payer chooses among tied copies (UI: auto-pick with override).
**Tag:** CORE for forced rank + wild exclusion; UNCERTAIN (lean payer-chooses) for the tied-copy suit choice — no source forces a specific copy.

## 5. Return tribute (还贡) choice

**Answer:** Confirmed a free choice among a set, not a forced card: the returner picks **any one card with point value ≤ 10**. Official rules add an edge case: if the whole hand is >10, return the **smallest** card. The ≤10 bound is by effective/level value, not raw face: one competitive explainer states explicitly that if the level is 10, the return must be ≤9 — i.e., current level cards are not returnable even when their face point is ≤10 (matching your levelValue formulation). pagat records the historical base rule as "any unwanted card ≠ the tribute card" with the ≤10 cap listed as a (now-dominant) variant — so ≤10 is the Chinese standard but technically a parameter. No platform found restricting the choice further. Visibility: public — see Q6; official double-tribute procedure has returns handed face-down then revealed simultaneously (so the two returns become public at the same moment; no one is permanently blind to them).

**Per-source findings:** official 「上游选择全手牌中**任意**一张牌点不超过10的牌还给下游，如全手牌均大于10，则还最小的牌」 ([52hrtt](https://www.52hrtt.com/ny/n/w/info/F1702965842341)); [163.com](https://www.163.com/dy/article/KI4HEOK50511CTRH.html) (「不超过10（包含10，如果级牌正打到10，则不超过9）」); [pagat.com](https://www.pagat.com/climbing/guan_dan.html) ("any unwanted card… must be different from the tribute card"; "Some play that the card returned… must be ranked 10 or lower"); [zh.wikipedia](https://zh.wikipedia.org/zh-hans/%E6%8E%BC%E8%9B%8B) (「2至10之间」). Some casual/company rule sheets say 「还一张任意牌」 (JJ page wording) — conflicts with the ≤10 standard; JJ's page is poorly written and explainer consensus + official rules use ≤10.

**Proposed default:** free choice among cards with levelValue ≤ 10; if none, forced smallest card (implement the official fallback); returned card public.
**Tag:** CORE for "free choice within the eligible set" and the level-card exclusion; VARIANT only for the cap itself (≤10 standard vs pagat's "any card" old-style) and the all->10 fallback (official-rules detail many casual sheets omit).

## 6. Tribute/return card visibility

**Answer:** Both are public to all four players. pagat states both are given **face up**; the official double-tribute text has cards handed face-down only as a *simultaneity device*, followed by mandatory simultaneous reveal (「两位进贡者同时亮牌」) — end state is public. All platform rule pages and explainers describe tribute/return as announced/shown events; **no source was found describing any platform hiding either card from the two uninvolved players.** (Caveat: I verified published rule texts, not each client's actual UI; absence of a "hidden" rule is the evidence.)

**Per-source findings:** [pagat.com](https://www.pagat.com/climbing/guan_dan.html) ("pays tribute by giving his or her highest ranked single card… **face up**"; return "gives an unwanted card **face up**"); official trial rules reveal clause ([52hrtt](https://www.52hrtt.com/ny/n/w/info/F1702965842341)); [tcy365](https://www.tcy365.com/news/d30358.html) (face-down handover, simultaneous reveal after both received); platform pages ([jj.cn](https://www.jj.cn/news/320/20120613160600024346.shtml), [guandan.uc55.com](https://guandan.uc55.com/Rule/Detail/201801_000209.html)) show these as public events.

**Proposed default:** both tribute and return cards visible to all four players (broadcast events); in 双下, reveal both returns atomically/simultaneously.
**Tag:** CORE (the simultaneous-reveal-in-双下 detail: CORE per official rules, though casual play is looser).

---

**Summary of genuine cross-source conflicts found:** (1) equal-rank 双贡 allocation — official seat-order (顺时针/头游下家) vs 唐人游 random vs pagat winners-choose; (2) return-card cap — Chinese standard ≤10 vs pagat's older "any card" base rule; (3) pagat's equal-tribute "payers agree who leads" vs the universal Chinese rule that the payer whose card went to 头游 leads. Everything else checked was concordant.