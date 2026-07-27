// SIMULTANEITY — at the decision moment, can the player see everything the
// decision needs AT ONCE?
//
// WHY THIS EXISTS. The fold metric is VOID for the phone. It asked "is Play
// above the fold at scrollY=0", answered ~8% at inner 390x844 — a height no
// phone browser presents — and at a real 390x664 the true rate is 100% at every
// pile depth. `ScrollActionsIntoView` has absorbed that 100% all along, so the
// question the fold gate was really standing in for was never "does Play fit".
// It was: WHAT DOES THE AUTO-SCROLL COST?
//
// Scrolling is not free, and the cost is not vertical space — it is
// SIMULTANEITY. `scrollIntoView({block:'nearest'})` pulls the action row up to
// the viewport's bottom edge; everything more than innerH above that row leaves
// the screen at the same moment. A taller indicator does not vanish from the
// ledger when the fold metric dies; it moves to THIS one, because every extra
// pixel between the top fact and the action row is a pixel of something the
// player must see being pushed off the top.
//
// THE STRUCTURAL FORM OF THE QUESTION (practice 14 — a proof beats a sample).
// Whether some scroll position exists that shows every must-see fact is not
// deal-sampled and not scroll-dependent. Let
//
//     requiredSpan = max(bottom of any must-see fact)
//                  - min(top    of any must-see fact)      [DOCUMENT coords]
//
// If requiredSpan > innerH then NO scroll offset shows them all — not the one
// the auto-scroll picks, not one the player could find by hand, not any. The
// deficit is exactly requiredSpan - innerH and it is a property of the layout at
// that viewport and that deal. Sampling then answers only HOW OFTEN and BY HOW
// MUCH, which is the question a sample can actually answer.
//
// TWO NUMBERS, NOT ONE. The probe reports both:
//   - the STRUCTURAL verdict (deficit vs innerH), which no scroll can escape;
//   - what is ACTUALLY visible at the SETTLED scroll position, which is what the
//     player experiences today.
// They differ: a layout can be structurally feasible and still be scrolled to a
// bad place. Recording only the first would excuse a bad auto-scroll; only the
// second would blame the auto-scroll for an impossible layout.
//
// Usage: import SIMULTANEITY_PROBE and run it in the page AFTER the auto-scroll
// has settled. Pass its result to summarizeSimultaneity.

/**
 * THE MUST-SEE SET — the definition this metric rests on, written down where a
 * reader can argue with it.
 *
 * This list IS the metric. "Reachable" on a scrolling phone layout is a
 * definition question, not a measurement, so the set is declared explicitly and
 * graded in tiers rather than asserted flat: a caller can compute the span over
 * `critical` alone, or over everything, and the two answers are reported side by
 * side so nobody has to accept one framing to read the result.
 *
 * `critical` means: a player who cannot see this cannot correctly decide the
 * play in front of them. `context` means: they can decide, but worse.
 */
export const MUST_SEE = [
  {
    key: 'trick',
    selectors: ['.gd-well'],
    why: 'The cards on the table are what a play must beat. On a LEAD the well is empty and renders at 0x0 — the fact is then absent rather than clipped, and every profile skips it.',
  },
  {
    key: 'desk',
    selectors: ['.gd-desk'],
    why: 'The own-turn surface: turn identity, clock, the staged cards at full face size, the combination reading, and whether it beats the table. Subsumes .gd-desk__stage and .gd-desk__status, so the box is the conservative (larger) one.',
  },
  {
    key: 'hand',
    selectors: ['.gd-fan'],
    why: 'The cards being chosen from. Measured as the whole fan: a clipped fan hides candidate plays the player does not know to look for.',
  },
  {
    key: 'actions',
    selectors: ['.gd-actionsRow__bar'],
    why: 'Play/Pass — the control being committed to, and the target the auto-scroll exists to reveal.',
  },
  {
    key: 'levels',
    selectors: ['.gd-headline'],
    why: 'The two team level badges say which level is live, and the level rank IS the wild. Contested: it is also CONSTANT for a whole hand, so a player may carry it in memory.',
  },
  {
    key: 'counts',
    selectors: ['.gd-seatcount'],
    why: 'How many cards each opponent holds. Contested: it changes every play and decides endgame lines, but both external lineages judged it strategic rather than turn-local.',
  },
  {
    key: 'seats',
    selectors: ['.gd-plate'],
    why: 'Who is who, and who is the partner. Stable across the hand.',
  },
];

/**
 * THE DEFINITION IS NOT SETTLED, SO THE INSTRUMENT DOES NOT SETTLE IT.
 *
 * What "reachable" means on a scrolling phone layout is a design question, not a
 * measurement, and three independent framings disagree — so all three are
 * computed from ONE run and printed side by side. Choosing between them is the
 * owner's ruling; a script that silently picked one would be making a design
 * decision inside a measurement, which is how the 844 default did its damage.
 *
 * The disagreements are real and worth stating:
 *   - `levels` and `counts` are CRITICAL in the in-house set and EXCLUDED by
 *     both external lineages. Grok's argument is the sharp one: `.gd-headline`
 *     sits at the very top of the column, so requiring it drags the span back to
 *     "everything above the fold" and quietly rebuilds the metric this replaces.
 *   - `desk` was MISSING from the in-house set and is tier-0 in both external
 *     ones. It carries whether the staged cards are legal and whether they beat
 *     the table, which is decision state nothing else shows.
 */
export const PROFILES = {
  'in-house': {
    facts: ['trick', 'levels', 'counts', 'hand', 'desk', 'actions'],
    note: 'Strictest. Everything a Guandan decision consults, including the live wild rank and opponents\' remaining counts.',
  },
  panel: {
    facts: ['trick', 'desk', 'hand', 'actions'],
    note: 'Codex and Grok converged here independently: the table top, the own-turn desk, the fan, and the control. Levels and seat counts excluded as match-scale rather than turn-local.',
  },
  minimal: {
    facts: ['desk', 'actions'],
    note: 'The weakest defensible reading: commit to a play while seeing what you are committing. Failing THIS is unambiguous under any definition.',
  },
};

/**
 * In-page probe. Reports DOCUMENT-coordinate boxes (practice 11: a
 * viewport-relative reading on an auto-scrolled page measures the safety net,
 * not the layout), the structural span, and what is actually visible now.
 *
 * Throws by returning an `error` when a CRITICAL selector matches nothing — a
 * simultaneity probe whose must-see set silently shrank would report a clean
 * span for a layout it was not looking at (practice 24: a clean zero is what you
 * get when nothing is wrong AND when you are not looking at the right thing).
 */
export const SIMULTANEITY_PROBE = `(opt) => {
  const MUST_SEE = ${JSON.stringify(MUST_SEE)};
  const r = (n) => Math.round(n * 10) / 10;
  const sx = window.scrollX, sy = window.scrollY;
  const innerH = window.innerHeight;

  const facts = [];
  const missingCritical = [];
  const emptyFacts = [];
  let elements = 0;

  for (const f of MUST_SEE) {
    const els = [];
    let matched = 0;
    for (const sel of f.selectors) {
      for (const el of document.querySelectorAll(sel)) {
        matched += 1;
        const q = el.getBoundingClientRect();
        if (q.width === 0 && q.height === 0) continue;
        els.push({ sel, top: q.top + sy, bottom: q.bottom + sy, vTop: q.top, vBottom: q.bottom });
      }
    }
    // MATCHED NOTHING vs MATCHED AN EMPTY BOX are different, and collapsing them
    // would hide a real defect behind a legitimate state. The trick well is the
    // case that forces the distinction: \`.gd-well\` has no min-height, so on a
    // deal where the viewer LEADS a fresh trick it renders at 0x0 — a correct
    // render of "there is nothing to beat", with genuinely nothing to see and
    // therefore nothing that can be clipped. A selector that matches NO element
    // at all is the other thing entirely: the must-see set silently shrank and
    // any span computed from it is a span of the wrong layout.
    if (matched === 0) {
      missingCritical.push(f.key);
      continue;
    }
    if (els.length === 0) {
      emptyFacts.push(f.key);
      continue;
    }
    elements += els.length;

    // The fact's DOCUMENT extent is the union over its elements: all four seat
    // counts are one fact, and seeing three of them is not seeing it.
    const top = Math.min(...els.map((e) => e.top));
    const bottom = Math.max(...els.map((e) => e.bottom));

    // Visibility NOW, per element, taking the WORST — the same reason as above.
    let worstFrac = 1;
    let worstSel = null;
    for (const e of els) {
      const h = e.vBottom - e.vTop;
      const vis = Math.max(0, Math.min(e.vBottom, innerH) - Math.max(e.vTop, 0));
      const frac = h > 0 ? vis / h : 1;
      if (frac < worstFrac) { worstFrac = frac; worstSel = e.sel; }
    }

    facts.push({
      key: f.key,
      why: f.why,
      count: els.length,
      docTop: r(top),
      docBottom: r(bottom),
      heightPx: r(bottom - top),
      visibleFrac: Math.round(worstFrac * 1000) / 1000,
      worstSelector: worstSel,
      fullyVisible: worstFrac >= 0.999,
    });
  }

  if (missingCritical.length > 0) {
    return { error: 'critical must-see fact(s) matched no rendered element: ' + missingCritical.join(', ') };
  }

  // NO PROFILE MATH HERE. The probe reports each fact's document extent and its
  // visibility, and nothing else. Which facts constitute "the decision" is a
  // DEFINITION, and it is applied in the report so that one measurement can be
  // read under every candidate definition without re-running anything.
  return {
    innerW: window.innerWidth,
    innerH,
    scrollY: r(sy),
    docHeight: r(document.documentElement.scrollHeight),
    maxScrollY: r(document.documentElement.scrollHeight - innerH),
    elementsExamined: elements,
    factsExamined: facts.map((f) => f.key),
    // Present but zero-sized, i.e. rendered with nothing in them. Reported
    // rather than dropped, so a reader can see what the span EXCLUDED and at
    // what rate — practice 24's "say what a zero is a zero of".
    emptyFacts,
    facts,
  };
}`;

/** Union document span of the named facts present in one sample. */
export function spanFor(sample, keys) {
  const rows = sample.facts.filter((f) => keys.includes(f.key));
  if (rows.length === 0) return null;
  const top = Math.min(...rows.map((f) => f.docTop));
  const bottom = Math.max(...rows.map((f) => f.docBottom));
  return {
    top,
    bottom,
    span: Math.round((bottom - top) * 10) / 10,
    deficit: Math.round((bottom - top - sample.innerH) * 10) / 10,
    feasible: bottom - top <= sample.innerH,
    allVisibleNow: rows.every((f) => f.fullyVisible),
    worstFracNow: Math.min(...rows.map((f) => f.visibleFrac)),
    present: rows.map((f) => f.key),
  };
}

/**
 * DROP-ONE. Which fact is spending the vertical budget? For each fact in the
 * profile, the span the others would need without it. This is what turns "it
 * does not fit" into "it does not fit BECAUSE", which is the difference between
 * a measurement and a diagnosis.
 */
export function dropOneFor(sample, keys) {
  const base = spanFor(sample, keys);
  if (base === null) return [];
  return base.present.map((k) => {
    const rest = spanFor(sample, keys.filter((x) => x !== k));
    return {
      without: k,
      spanPx: rest === null ? 0 : rest.span,
      savesPx: Math.round((base.span - (rest === null ? 0 : rest.span)) * 10) / 10,
    };
  });
}

/** Fold one probe result into a run tally. Throws on a vacuous or failed probe. */
export function recordSimultaneity(result, label, tally) {
  if (result === null || result.error) {
    throw new Error(`simultaneity probe failed at ${label}: ${result?.error ?? 'no result'}`);
  }
  if (result.elementsExamined < 6) {
    throw new Error(
      `simultaneity probe at ${label} examined only ${result.elementsExamined} elements — ` +
        'the must-see set matched almost nothing, so any span it reports is a span of nothing.',
    );
  }
  tally.runs += 1;
  tally.samples.push({ at: label, ...result });
  return result;
}

export const newSimTally = () => ({ runs: 0, samples: [] });

/**
 * Report. Practice 16: this is an "always ≥"/"always fits" property, so it
 * prints the WORST case and the VIOLATION RATE, never a median.
 */
export function reportSimultaneity(tally, { innerW, innerH, at = 'the settled scroll' }) {
  const s = tally.samples;
  console.log(`\n--- SIMULTANEITY (${s.length} sample(s) at INNER ${innerW}x${innerH}) ---`);
  if (s.length === 0) {
    console.log('no samples.');
    return false;
  }
  console.log(
    'Scope (practice 24 — what a zero would be a zero OF): ' +
      `${s[0].factsExamined.join(', ')} — ${s[0].elementsExamined} elements in the first sample.`,
  );
  const emptyRate = {};
  for (const x of s) for (const k of x.emptyFacts ?? []) emptyRate[k] = (emptyRate[k] ?? 0) + 1;
  const emptyLine = Object.entries(emptyRate)
    .map(([k, n]) => `${k} ${n}/${s.length}`)
    .join(', ');
  console.log(
    `Present but EMPTY (rendered at 0x0, excluded from the span): ${emptyLine === '' ? 'none' : emptyLine}` +
      (emptyRate.trick ? '  — an empty trick well is the viewer LEADING: nothing to beat, nothing to clip.' : ''),
  );
  console.log(
    'INNER viewport, browser chrome EXCLUDED. A 390x844 phone presents ~664 inner ' +
      'with toolbars, ~748 minimized; 844 itself is a screen size no browser produces.',
  );

  const pct = (k) => `${((100 * k) / s.length).toFixed(1)}%`;
  const wilson = (k, n) => {
    if (n === 0) return '[--, --]';
    const z = 1.96;
    const p = k / n;
    const d = 1 + (z * z) / n;
    const c = p + (z * z) / (2 * n);
    const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return `[${(100 * ((c - m) / d)).toFixed(1)}%, ${(100 * ((c + m) / d)).toFixed(1)}%]`;
  };

  // ONE MEASUREMENT, EVERY CANDIDATE DEFINITION. The rows below differ only in
  // which facts the definition counts, so a reader can see how much of the
  // verdict is layout and how much is the definition.
  const verdicts = {};
  console.log('\nSTRUCTURAL — does ANY scroll offset show the whole decision at once?');
  console.log('  (span > innerH means no offset exists: not the auto-scroll\'s, not one found by hand)\n');
  // The last column is scroll-position-dependent, so it names the position it
  // was taken at rather than assuming one. The same report is printed for the
  // settled scroll and for scrollY=0, and a fixed "at-settled" header on the
  // scrollY=0 block would be a mislabelled reading of the kind this project has
  // already recorded twice.
  console.log(
    `  profile     infeasible          worst span   worst deficit   not-all-visible at ${at}`,
  );
  for (const [name, prof] of Object.entries(PROFILES)) {
    const spans = s.map((x) => spanFor(x, prof.facts)).filter(Boolean);
    if (spans.length === 0) continue;
    const infeasible = spans.filter((x) => !x.feasible).length;
    const notVis = spans.filter((x) => !x.allVisibleNow).length;
    const worstSpan = Math.max(...spans.map((x) => x.span));
    const worstDef = Math.max(...spans.map((x) => x.deficit));
    verdicts[name] = { infeasible, notVis, worstSpan, worstDeficit: worstDef, n: spans.length };
    console.log(
      `  ${name.padEnd(11)} ${String(infeasible + '/' + spans.length).padStart(6)} = ` +
        `${pct(infeasible).padStart(6)} ${wilson(infeasible, spans.length).padEnd(17)} ` +
        `${String(worstSpan).padStart(7)}px  ${(worstDef >= 0 ? '+' : '') + worstDef}px`.padEnd(16) +
        `   ${String(notVis + '/' + spans.length).padStart(6)} = ${pct(notVis)}`,
    );
  }
  console.log('');
  for (const [name, prof] of Object.entries(PROFILES)) {
    console.log(`  ${name}: {${prof.facts.join(', ')}} — ${prof.note}`);
  }

  // Per-fact worst case: the minimum visible fraction each fact ever reached,
  // and how often it was clipped at all.
  console.log('\nPER FACT (min visible fraction, clip rate) — a floor, so min and rate, not median:');
  const keys = s[0].facts.map((f) => f.key);
  for (const key of keys) {
    const rows = s.map((x) => x.facts.find((f) => f.key === key)).filter(Boolean);
    if (rows.length === 0) continue;
    const min = Math.min(...rows.map((f) => f.visibleFrac));
    const clipped = rows.filter((f) => !f.fullyVisible).length;
    const maxH = Math.max(...rows.map((f) => f.heightPx));
    const inProfiles = Object.entries(PROFILES)
      .filter(([, p]) => p.facts.includes(key))
      .map(([n]) => n);
    // `union span` is the fact's whole DOCUMENT extent — for `counts` that is
    // top-seat-count to side-seat-count, not one badge's height. Named
    // explicitly because "tallest" read as a single element's height and that
    // made a 787px number look like a bug.
    console.log(
      `  ${key.padEnd(8)} min visible ${(100 * min).toFixed(1).padStart(5)}%  ` +
        `clipped ${String(clipped + '/' + rows.length).padStart(6)} = ${pct(clipped).padStart(6)}  ` +
        `union span ${String(maxH).padStart(6)}px  in: ${inProfiles.join(',') || '(none)'}`,
    );
  }

  // Drop-one on the STRICTEST profile: which fact is spending the budget.
  console.log("\nDROP-ONE on the 'in-house' profile (worst deal) — where the vertical budget goes:");
  const strict = PROFILES['in-house'].facts;
  const worstSample = s.reduce((a, b) =>
    (spanFor(b, strict)?.deficit ?? -Infinity) > (spanFor(a, strict)?.deficit ?? -Infinity) ? b : a,
  );
  for (const d of dropOneFor(worstSample, strict).sort((a, b) => b.savesPx - a.savesPx)) {
    console.log(
      `  without ${d.without.padEnd(8)} span ${String(d.spanPx).padStart(7)}px ` +
        `(saves ${d.savesPx}px, ${d.spanPx <= innerH ? 'FITS' : 'still short by ' + Math.round(d.spanPx - innerH) + 'px'})`,
    );
  }

  // The exit condition uses the WEAKEST profile deliberately: failing `minimal`
  // is a failure under every definition anyone has proposed, so it cannot be
  // argued away by re-litigating the must-see set. A stricter threshold is the
  // owner's ruling to make, not this script's.
  const m = verdicts.minimal;
  return m !== undefined && m.infeasible === 0 && m.notVis === 0;
}

/**
 * PROPERTY 4, stated literally: "nothing else the player must see scrolls OUT as
 * Play scrolls in." The reports above answer the stronger structural question
 * (is any offset sufficient); this answers the owner's exact wording, by pairing
 * each deal's scrollY=0 reading with its settled one and naming what was traded.
 *
 * The two are different claims and both are worth having. A layout could satisfy
 * this one trivially by never scrolling — and fail the structural test anyway,
 * because the facts never fitted together in the first place.
 */
export function reportScrollTrade(topTally, settledTally) {
  const n = Math.min(topTally.samples.length, settledTally.samples.length);
  console.log(`\n--- PROPERTY 4: WHAT THE AUTO-SCROLL TRADED (${n} paired deals) ---`);
  if (n === 0) {
    console.log('no paired samples.');
    return false;
  }
  const lost = new Map();
  const gained = new Map();
  const lossByProfile = Object.fromEntries(Object.keys(PROFILES).map((k) => [k, 0]));
  for (let i = 0; i < n; i += 1) {
    const before = topTally.samples[i];
    const after = settledTally.samples[i];
    const lostKeys = [];
    for (const f of before.facts) {
      const g = after.facts.find((x) => x.key === f.key);
      if (g === undefined) continue;
      if (f.fullyVisible && !g.fullyVisible) {
        lost.set(f.key, (lost.get(f.key) ?? 0) + 1);
        lostKeys.push(f.key);
      }
      if (!f.fullyVisible && g.fullyVisible) gained.set(f.key, (gained.get(f.key) ?? 0) + 1);
    }
    for (const [name, prof] of Object.entries(PROFILES)) {
      if (lostKeys.some((k) => prof.facts.includes(k))) lossByProfile[name] += 1;
    }
  }
  const fmt = (m) =>
    m.size === 0
      ? 'nothing'
      : [...m.entries()].map(([k, c]) => `${k} (${c}/${n} deals)`).join(', ');
  console.log(`  GAINED by scrolling: ${fmt(gained)}`);
  console.log(`  LOST  by scrolling: ${fmt(lost)}`);
  console.log('  deals where the scroll traded away a fact the profile requires:');
  for (const [name, c] of Object.entries(lossByProfile)) {
    console.log(`    ${name.padEnd(11)} ${String(c + '/' + n).padStart(6)} = ${((100 * c) / n).toFixed(1)}%`);
  }
  // Same reasoning as reportSimultaneity: the weakest profile decides, because
  // failing it cannot be argued away by re-litigating the must-see set.
  return lossByProfile.minimal === 0;
}
