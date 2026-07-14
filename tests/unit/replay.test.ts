// Deterministic replay harness tests (PLAN.md §6 — M1 deliverable).
// Exercises scripts/replay.ts's library API only; the CLI wrapper is a thin
// I/O shim over the same replayMatch/recordPlayout functions tested here.

import { describe, expect, it } from 'vitest';
import { JIANGSU_OFFICIAL_ONLINE } from '../../src/engine/guandan/config';
import type { RuleVariant } from '../../src/engine/guandan/config';
import type { GuandanAction } from '../../src/engine/guandan/types';
import { recordPlayout, replayMatch, type ReplayInput } from '../../scripts/replay';

/** Snapshot every recorded state at its seq, in the {seq, state} shape
 *  replayMatch's opts.snapshots expects. */
function snapshotsFrom(states: unknown[]): { seq: number; state: unknown }[] {
  return states.map((state, seq) => ({ seq, state }));
}

describe('replay harness (scripts/replay.ts)', () => {
  it('reconstructs a scripted match bit-for-bit under the default profile', () => {
    const rec = recordPlayout('replay-golden-default', JIANGSU_OFFICIAL_ONLINE, undefined, {
      maxActions: 20_000,
      stopAfterHands: 3,
    });
    expect(rec.artifact.actions.length).toBeGreaterThan(0);
    // Sanity: at least 3 hands actually completed (handNo advanced at least
    // to 4, or the match ended earlier — either is a legitimate stop).
    const finalState = rec.states[rec.states.length - 1]!;
    expect(finalState.handNo).toBeGreaterThanOrEqual(3);

    const snapshots = snapshotsFrom(rec.states);
    const result = replayMatch(rec.artifact, { snapshots });

    expect(result.ok).toBe(true);
    expect(result.divergence).toBeUndefined();
    expect(result.rejection).toBeUndefined();
    expect(result.states).toEqual(rec.states);
    expect(result.events).toEqual(rec.events);
    expect(result.finalState).toEqual(finalState);
  });

  it('reconstructs a scripted match bit-for-bit under a variant config (aFailConsequence=demote)', () => {
    const config: RuleVariant = { ...JIANGSU_OFFICIAL_ONLINE, aFailConsequence: 'demote', aFailDemoteTo: 'level2' };
    const rec = recordPlayout('replay-golden-variant', config, undefined, {
      maxActions: 20_000,
      stopAfterHands: 3,
    });
    expect(rec.artifact.actions.length).toBeGreaterThan(0);
    expect(rec.artifact.config.aFailConsequence).toBe('demote');

    const snapshots = snapshotsFrom(rec.states);
    const result = replayMatch(rec.artifact, { snapshots });

    expect(result.ok).toBe(true);
    expect(result.divergence).toBeUndefined();
    expect(result.states).toEqual(rec.states);
    expect(result.events).toEqual(rec.events);
  });

  it('reports a divergence (or a structured rejection) at exactly the tampered seq — never a crash', () => {
    const rec = recordPlayout('replay-tamper-action', JIANGSU_OFFICIAL_ONLINE, undefined, {
      maxActions: 20_000,
      stopAfterHands: 2,
    });
    expect(rec.artifact.actions.length).toBeGreaterThan(5);

    // Tamper a mid-match action: swap a pass for a play claim that swaps
    // the wrong seat, or if it's a play, force it to 'pass' instead. Either
    // way the true recorded state was reached honestly, so the replay must
    // disagree with the recorded snapshot at exactly this seq (or the
    // engine itself must reject the tampered action outright).
    const tamperIndex = Math.floor(rec.artifact.actions.length / 2);
    const original = rec.artifact.actions[tamperIndex]!;
    const tamperedAction: GuandanAction = original.action.type === 'pass' ? { type: 'pass' } : { type: 'pass' };
    // Force a genuine divergence-producing tamper: flip pass<->non-pass.
    const tampered: ReplayInput = {
      ...rec.artifact,
      actions: rec.artifact.actions.map((entry, i) =>
        i === tamperIndex ? { seat: entry.seat, action: original.action.type === 'pass' ? tamperedAction : { type: 'pass' } } : entry,
      ),
    };
    // If our synthetic tamper happened to also be 'pass' (i.e. original was
    // already 'pass' and forcing 'pass' again is a no-op), force a
    // different, definitely-distinct tamper: swap the acting seat instead.
    if (tampered.actions[tamperIndex]!.action.type === original.action.type) {
      tampered.actions[tamperIndex] = { seat: ((original.seat + 1) % 4), action: original.action };
    }

    const tamperSeq = tamperIndex + 1;
    const snapshots = snapshotsFrom(rec.states);
    const result = replayMatch(tampered, { snapshots });

    expect(result.ok).toBe(false);
    // Never crashes: we got a structured result either way.
    expect(result.divergence !== undefined || result.rejection !== undefined).toBe(true);
    if (result.divergence) expect(result.divergence.seq).toBe(tamperSeq);
    if (result.rejection) expect(result.rejection.seq).toBe(tamperSeq);
  });

  it('reports a divergence at exactly the tampered snapshot seq', () => {
    const rec = recordPlayout('replay-tamper-snapshot', JIANGSU_OFFICIAL_ONLINE, undefined, {
      maxActions: 20_000,
      stopAfterHands: 2,
    });
    expect(rec.states.length).toBeGreaterThan(5);

    const tamperSeq = Math.floor(rec.states.length / 2);
    const snapshots = snapshotsFrom(rec.states);
    snapshots[tamperSeq] = { seq: tamperSeq, state: { ...(rec.states[tamperSeq] as object), handNo: -999 } };

    const result = replayMatch(rec.artifact, { snapshots });

    expect(result.ok).toBe(false);
    expect(result.divergence).toBeDefined();
    expect(result.divergence!.seq).toBe(tamperSeq);
    expect(result.rejection).toBeUndefined();
  });

  it('the artifact JSON-roundtrips', () => {
    const rec = recordPlayout('replay-roundtrip', JIANGSU_OFFICIAL_ONLINE, undefined, {
      maxActions: 5_000,
      stopAfterHands: 1,
    });
    const roundTripped = JSON.parse(JSON.stringify(rec.artifact)) as ReplayInput;
    expect(roundTripped).toEqual(rec.artifact);

    // And replaying the round-tripped artifact reproduces the same states.
    const result = replayMatch(roundTripped, { snapshots: snapshotsFrom(rec.states) });
    expect(result.ok).toBe(true);
  });

  it('is deterministic: replaying the same artifact twice is identical', () => {
    const rec = recordPlayout('replay-determinism', JIANGSU_OFFICIAL_ONLINE, undefined, {
      maxActions: 20_000,
      stopAfterHands: 3,
    });
    const a = replayMatch(rec.artifact);
    const b = replayMatch(rec.artifact);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.states).toEqual(b.states);
    expect(a.events).toEqual(b.events);
    expect(a.finalState).toEqual(b.finalState);
  });
});
