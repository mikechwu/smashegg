// CONTAINMENT — does everything that should be inside its container actually
// render inside it?
//
// WHY THIS EXISTS, AND WHY IT IS GENERAL RATHER THAN A FIX FOR ONE BUG.
//
// Rung 0 shipped a build in which `.gd-ring__table` rendered 24px WIDER than
// the `.gd-table` containing it (width:100% plus its own padding, with no
// global border-box in this project). `.gd-table { overflow-x: hidden }` then
// CLIPPED THE EAST SEAT — a whole player — at inner 720, 1024, 1280 and 1440.
//
// What made it dangerous was not the mistake but that nothing could see it:
//   - no horizontal scrollbar, BECAUSE `overflow-x: hidden` is what suppresses
//     one. The declaration whose job is to prevent horizontal overflow is
//     exactly what turned a visible layout bug into a symptomless one;
//   - no failing test — the client suite is DOM-free;
//   - the fold gate still read 0/24, because it measures Play's VERTICAL
//     position and nothing else.
//
// That is the same family as ScrollActionsIntoView masking the fold
// (METHODOLOGY practice 11 — name the compensator before measuring), and worse
// in consequence: the compensator made a player disappear.
//
// The existing gates each measure a defect that has already happened — Play's
// document position, card occlusion, the set-aside control's presence — so they
// are structurally blind to a NEW class. This one asks a question none of them
// ask, and it is deliberately about a PROPERTY ("things are inside their
// containers") rather than about a symptom, so it catches a family.
//
// Usage: import CONTAINMENT_PROBE and checkContainment; run the probe in the
// page and pass its result to the checker. See measure-fold.mjs for a caller.

/**
 * In-page probe. Returns every containment violation it can find, plus the
 * counts it examined so a caller can prove the check was not vacuous.
 *
 * TOLERANCE: sub-pixel layout rounding is normal, so a box may exceed its
 * container by up to `tol` px without being reported. The clipped-seat bug
 * overshot by 16px, i.e. two orders of magnitude above any rounding.
 */
export const CONTAINMENT_PROBE = `(opt) => {
  const tol = opt.tol ?? 1;
  const r = (n) => Math.round(n * 10) / 10;
  const violations = [];
  let checked = 0;

  const table = document.querySelector('.gd-table');
  if (table === null) return { error: 'no .gd-table — nothing to contain' };
  const tq = table.getBoundingClientRect();

  // The things a player must be able to SEE. Deliberately not "every element":
  // a whitelist states what the property is about, and a new selector has to be
  // added on purpose rather than silently inheriting a guarantee.
  const INSIDE_TABLE = [
    '.gd-ring__table',
    '.gd-ring__seat--north', '.gd-ring__seat--west', '.gd-ring__seat--east',
    '.gd-ring__center',
    '.gd-seatzone', '.gd-seatstack', '.gd-seatcount', '.gd-plate',
    '.gd-well', '.gd-well__cards',
    '.gd-handzone', '.gd-fan', '.gd-fan__stackRow', '.gd-fan__stack', '.gd-fan__card',
    '.gd-desk', '.gd-actionsRow', '.gd-actionsRow__bar', '.gd-actionsRow__sort',
    '.gd-bottombar', '.gd-feed', '.gd-headline',
  ];
  // Legitimately outside the table's box: viewport-fixed chrome and modal
  // surfaces. Listed rather than filtered by computed position, so that a rule
  // silently BECOMING fixed does not silently gain an exemption.
  const EXEMPT = ['.gd-toast', '.gd-chooser', '.gd-sf', '.gd-overlay'];

  const exempt = (el) => EXEMPT.some((sel) => el.closest(sel) !== null);

  for (const sel of INSIDE_TABLE) {
    for (const el of document.querySelectorAll(sel)) {
      if (exempt(el)) continue;
      const q = el.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) continue;   // not rendered this phase
      checked += 1;
      const over = {
        left: r(tq.left - q.left),
        right: r(q.right - tq.right),
      };
      if (over.left > tol || over.right > tol) {
        violations.push({
          kind: 'outside .gd-table',
          selector: sel,
          overflowLeftPx: over.left > tol ? over.left : 0,
          overflowRightPx: over.right > tol ? over.right : 0,
          box: { left: r(q.left), right: r(q.right), width: r(q.width) },
          container: { left: r(tq.left), right: r(tq.right), width: r(tq.width) },
          // The masking mechanism, recorded WITH the violation so a reader
          // cannot mistake "no scrollbar" for "no overflow" (practice 11).
          containerOverflowX: getComputedStyle(table).overflowX,
        });
      }
      // …and nothing may leave the VIEWPORT, which is the failure a player
      // actually experiences.
      if (q.right > window.innerWidth + tol || q.left < -tol) {
        violations.push({
          kind: 'outside the viewport',
          selector: sel,
          box: { left: r(q.left), right: r(q.right) },
          innerWidth: window.innerWidth,
        });
      }
    }
  }

  // A CARD FRAME MUST NOT INFLATE ITS PARENT (practice 29 rung 4, and F2).
  //
  // NOTE FOR EDITORS: this whole probe is a template literal, so NO BACKTICKS may
  // appear anywhere in it, comments included. Adding them here terminated the literal
  // and produced a SyntaxError pointing at an unrelated identifier — the same trap this
  // project has hit once before.
  //
  // A .gd-cardframe is inline-flex; on the default vertical-align (baseline) its
  // parent's line box reserves the font's descender BELOW it, and a card with no
  // in-flow text (a joker, whose art is position:absolute) has its baseline at its
  // bottom margin edge — so the descender lands entirely below the card. Measured at
  // 5px on the staged-card button, on the 69% of hands that hold a joker, and it fed
  // straight into deskH and therefore into the G-SIM span.
  //
  // The CSS pin for the fix is a text match on the vertical-align declaration, which
  // survives only the exact line being deleted — not a changed display value, a new
  // wrapper, or a font change that alters the descender. This asserts the same property
  // where it actually lives: in the rendered boxes, at every card render site, at every
  // viewport this gate runs.
  for (const frame of document.querySelectorAll('.gd-cardframe')) {
    const parent = frame.parentElement;
    if (parent === null) continue;
    // Only meaningful where the frame is the sole element child; otherwise the parent
    // is legitimately sized by something else.
    if (parent.children.length !== 1) continue;
    const fq = frame.getBoundingClientRect();
    const pq = parent.getBoundingClientRect();
    if (fq.height === 0) continue;
    checked += 1;
    const excess = r(pq.height - fq.height);
    if (excess > tol) {
      violations.push({
        kind: 'card frame inflates its parent',
        selector: '.gd-cardframe',
        excessPx: excess,
        parent: String(parent.className || parent.tagName).slice(0, 60),
        frameH: r(fq.height),
        parentH: r(pq.height),
        verticalAlign: getComputedStyle(frame).verticalAlign,
        display: getComputedStyle(frame).display,
      });
    }
  }

  // THE FAN MUST NOT RENDER MORE THAN TWO LINES (G3).
  //
  // Every derivation in this arc assumes exactly two: the span decomposition, the
  // fanHeight bound, the lattice, the cardW sweep. Below roughly 310 CSS px of width a
  // 44px card cannot hold 15 value classes in two lines, and 200% page zoom on a 390px
  // phone produces a 195px CSS viewport — so the degradation is reachable, and today it
  // is SILENT. Nothing else in the gate set notices it.
  //
  // Counted by distinct stack BOTTOMS, because align-items: flex-end bottom-aligns a
  // line; distinct TOPS would count pile depths instead. The settled fan is ONE
  // .gd-fan__stackRow element that wraps internally, so counting elements reads 1 always
  // — that mistake stood in this project for several rounds.
  const stackRow = document.querySelector('.gd-fan__stackRow');
  if (stackRow !== null) {
    const stacks = [...stackRow.querySelectorAll('.gd-fan__stack')];
    if (stacks.length > 0) {
      const lines = new Set(stacks.map((el) => Math.round(el.getBoundingClientRect().bottom)));
      checked += 1;
      if (lines.size > 2) {
        violations.push({
          kind: 'fan renders more than two lines',
          selector: '.gd-fan__stackRow',
          lines: lines.size,
          columns: stacks.length,
          innerWidth: window.innerWidth,
        });
      }
    }
  }

  return {
    checked,
    violations,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    tableOverflowX: getComputedStyle(table).overflowX,
    pageHOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}`;

/**
 * Fold a probe result into a run-level tally. Throws on a probe that examined
 * nothing — a containment check that matched no elements would otherwise pass
 * every build, which is the failure mode this project has now shipped three
 * times (a gate that exits 0 having measured nothing).
 */
export function checkContainment(result, label, tally) {
  if (result === null || result.error) {
    throw new Error(`containment probe failed at ${label}: ${result?.error ?? 'no result'}`);
  }
  if (result.checked < 10) {
    throw new Error(
      `containment probe at ${label} examined only ${result.checked} elements — ` +
        'its selectors matched almost nothing, so a pass would be vacuous.',
    );
  }
  tally.checked += result.checked;
  tally.runs += 1;
  for (const v of result.violations) tally.violations.push({ at: label, ...v });
  return result.violations.length === 0;
}

/** Print the tally. Returns true when clean. */
export function reportContainment(tally) {
  console.log(
    `\n--- CONTAINMENT (${tally.runs} probe${tally.runs === 1 ? '' : 's'}, ` +
      `${tally.checked} element boxes examined) ---`,
  );
  if (tally.violations.length === 0) {
    console.log('PASS: every checked element renders inside .gd-table and inside the viewport.');
    return true;
  }
  console.log(`FAIL: ${tally.violations.length} containment violation(s).`);
  for (const v of tally.violations.slice(0, 20)) {
    if (v.kind === 'outside .gd-table') {
      console.log(
        `  ${v.at}: ${v.selector} overflows .gd-table by ` +
          `${v.overflowLeftPx ? v.overflowLeftPx + 'px LEFT ' : ''}` +
          `${v.overflowRightPx ? v.overflowRightPx + 'px RIGHT' : ''} ` +
          `(box ${v.box.left}..${v.box.right}, container ${v.container.left}..${v.container.right}) ` +
          `— container overflow-x is "${v.containerOverflowX}", which is what HIDES this.`,
      );
    } else if (v.kind === 'fan renders more than two lines') {
      console.log(
        `  ${v.at}: the fan rendered ${v.lines} LINES (${v.columns} columns at innerWidth ` +
          `${v.innerWidth}). Every derivation in this arc assumes exactly two — the span ` +
          `decomposition, the fanHeight bound, the lattice and the cardW sweep are all void ` +
          `here. Two lines need capacity >= 8, i.e. roughly 310 CSS px at a 44px card.`,
      );
    } else if (v.kind === 'card frame inflates its parent') {
      console.log(
        `  ${v.at}: a .gd-cardframe makes its parent ${v.excessPx}px taller than itself ` +
          `(frame ${v.frameH}, parent ${v.parentH}, parent "${v.parent}"). ` +
          `The frame is ${v.display} on vertical-align: ${v.verticalAlign} — a baseline-` +
          `aligned inline box reserves the font's descender below a card that has no ` +
          `in-flow text, which is every joker.`,
      );
    } else {
      console.log(
        `  ${v.at}: ${v.selector} leaves the viewport (box ${v.box.left}..${v.box.right}, ` +
          `innerWidth ${v.innerWidth})`,
      );
    }
  }
  if (tally.violations.length > 20) console.log(`  … and ${tally.violations.length - 20} more`);
  return false;
}

export const newTally = () => ({ checked: 0, runs: 0, violations: [] });
