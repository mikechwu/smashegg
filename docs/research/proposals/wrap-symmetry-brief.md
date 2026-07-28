# Is there a fan wrap policy that makes both sort orderings produce the same height?

You are one of two independent proposers on a **design/definition** question. Produce your own
framing. **No web research** — Firecrawl is disabled in this project and you do not need the web.
Work from the repository you were given. Do not modify it.

## The product
A four-player Guandan (掼蛋) card table, React + TS, phone-first at 390px inner width.
Start with `src/client/table/HandFan.tsx` (`groupHandColumns`, `stackOffsetW`) and
`src/client/table/table.css` (`.gd-fan__stackRow`, `.gd-fan__stack`).

## The mechanism
The player's hand renders as COLUMNS, one per value class (a run of equal levelValue), ordered by
value. The settled fan is ONE `.gd-fan__stackRow` with `flex-wrap: wrap`, so columns wrap
GREEDILY: at 390px a line holds 9 columns, so with C columns line 1 gets columns 1..9 and line 2
gets the rest. A hand has at most 15 columns and always renders on exactly 2 lines.

Fan height is driven ONLY by the deepest column on each line:
    fanHeight = 13.9 + lineH(d1) + 6 + lineH(d2),  lineH(d) = 73.5 + 21.3*(d-1)
where d1 = max depth on line 1, d2 = max depth on line 2.

## The problem
The player can toggle hand sort between ascending and descending (`pref:handSort`; ascending is
the default). Descending REVERSES column order, so a different set of columns lands on line 1 —
and therefore (d1, d2) differs, and so does fanHeight.

Measured consequence, at inner 390x664 in a default timed room, for whether the whole decision
fits on screen at once:
- ascending fails on 7.7% of deals
- descending fails on 9.2% of deals
- both fail on 3.8%; only-ascending 3.9%; only-descending 5.4%

So **descending costs feasibility (5.4%) more often than it rescues it (3.9%)** — the toggle is
net negative by ~1.6 percentage points. A pure display preference is silently changing whether the
player can see their own decision.

## The question
**Is there a wrap policy that makes the two orderings produce the same (d1, d2) multiset, and
therefore the same fanHeight — without harming the fan's readability or its reading order?**

Consider at least:
- a balanced split (ceil(C/2) / floor(C/2)) instead of greedy fill;
- splitting at a fixed midpoint;
- a content-based split (e.g. cut so the deepest column's line is determined by the hand, not by
  the direction);
- any policy you think of that I have not listed.

Note: a balanced split at exactly C/2 appears direction-symmetric for EVEN C but not for odd C,
where the extra column changes lines. If that is right, the tie-break for odd C is the crux — and
a direction-independent tie-break must depend on the CONTENT, not on position.

## Deliverable — use exactly these headings

### 1. IS IT POSSIBLE
Yes/no, with the argument. If a policy exists, state it precisely enough to implement.

### 2. THE POLICY
Precise rule. Cover odd and even C, and say what happens at C <= 9 (one line today).

### 3. WHAT IT COSTS
Reading order, visual balance, the seam between lines, and whether a line can now be
uncomfortably short or long. This project cares a lot about elderly players' reading of the hand.

### 4. WHAT IT DOES TO HEIGHT
Does symmetrising RAISE the typical height? Making both orderings equal is worthless if it
equalises them at the WORSE of the two. Reason about which of d1/d2 the policy tends to increase.

### 5. THE ALTERNATIVE ANSWERS
If no policy works, the options are: keep descending and accept it is worse; warn the player; or
remove the toggle. Rank them and say why. Removing a control elders may already rely on is a real
cost — say so if you think it dominates.

### 6. WHAT YOU ARE UNSURE OF
Be specific about what you could not determine from the code.

End with a single literal line:

    PROPOSAL COMPLETE: <N> sections
