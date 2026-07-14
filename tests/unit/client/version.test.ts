// Version-skew signal tests (M4): the skew predicate and dismissal keying,
// via createVersionSignal with pinned local builds — no React, no define
// (clientBuild's typeof guard is what makes this file runnable at all).

import { describe, expect, it } from 'vitest';
import { clientBuild, createVersionSignal } from '../../../src/client/version';

describe('clientBuild', () => {
  it("is the 'dev' sentinel under vitest (no vite define)", () => {
    expect(clientBuild()).toBe('dev');
  });
});

describe('versionSignal skew predicate', () => {
  it('no signal before any server build was reported', () => {
    expect(createVersionSignal('aaaaaaa').updateAvailable()).toBe(false);
  });

  it('two real, unequal builds -> update available (either direction)', () => {
    const stale = createVersionSignal('aaaaaaa');
    stale.reportServerBuild('bbbbbbb');
    expect(stale.updateAvailable()).toBe(true);

    // Rollout race: the client can briefly be NEWER than the DO. Direction
    // is deliberately not distinguished — reload is harmless either way.
    const ahead = createVersionSignal('bbbbbbb');
    ahead.reportServerBuild('aaaaaaa');
    expect(ahead.updateAvailable()).toBe(true);
  });

  it('equal builds -> silent (identical-commit redeploys never prompt)', () => {
    const signal = createVersionSignal('aaaaaaa');
    signal.reportServerBuild('aaaaaaa');
    expect(signal.updateAvailable()).toBe(false);
  });

  it("'dev' on EITHER side suppresses (fail-safe silent in local dev)", () => {
    const devClient = createVersionSignal('dev');
    devClient.reportServerBuild('aaaaaaa');
    expect(devClient.updateAvailable()).toBe(false);

    const devServer = createVersionSignal('aaaaaaa');
    devServer.reportServerBuild('dev');
    expect(devServer.updateAvailable()).toBe(false);
  });

  it('an absent welcome.build (old server) reports nothing', () => {
    const signal = createVersionSignal('aaaaaaa');
    signal.reportServerBuild(undefined);
    expect(signal.updateAvailable()).toBe(false);
  });

  it('dismissal is keyed by the server build string', () => {
    const signal = createVersionSignal('aaaaaaa');
    signal.reportServerBuild('bbbbbbb');
    expect(signal.updateAvailable()).toBe(true);

    // 'Later' hides THIS deploy for the session — including re-reports of
    // the same build on every subsequent reconnect.
    signal.dismiss();
    expect(signal.updateAvailable()).toBe(false);
    signal.reportServerBuild('bbbbbbb');
    expect(signal.updateAvailable()).toBe(false);

    // A SECOND newer deploy re-shows: the dismissal does not carry over.
    signal.reportServerBuild('ccccccc');
    expect(signal.updateAvailable()).toBe(true);
  });

  it('notifies subscribers on report and dismiss, not on no-ops', () => {
    const signal = createVersionSignal('aaaaaaa');
    let calls = 0;
    const unsubscribe = signal.subscribe(() => calls++);

    signal.reportServerBuild(undefined);
    signal.dismiss(); // nothing reported yet — no-op
    expect(calls).toBe(0);

    signal.reportServerBuild('bbbbbbb');
    expect(calls).toBe(1);
    signal.reportServerBuild('bbbbbbb'); // unchanged — no-op
    expect(calls).toBe(1);

    signal.dismiss();
    expect(calls).toBe(2);
    signal.dismiss(); // already dismissed for this build — no-op
    expect(calls).toBe(2);

    unsubscribe();
    signal.reportServerBuild('ccccccc');
    expect(calls).toBe(2);
  });
});
