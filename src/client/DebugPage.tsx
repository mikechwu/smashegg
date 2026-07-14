// The M0 connectivity-check demo (G-ALARM probe UI, PLAN.md §9), moved off
// the main page to '#/debug' by the M3 shell rework — kept verbatim because
// it remains the permanent live probe against /hello + /status.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HelloStatus } from '../shared/protocol';
import { t } from './i18n';

// G-ALARM demo room (PLAN.md §9). Not a real room a player creates — it
// only exists to exercise the hello/status/alarm probe wired up in M0.
const HELLO_ROOM_CODE = 'TABLE2'; // must match the server's 6-char room-code alphabet (no O/0/I/1)
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 30000;

type HelloState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'polling'; status: HelloStatus; startedAt: number }
  | { phase: 'done'; status: HelloStatus }
  | { phase: 'error' };

export function DebugPage() {
  const [helloState, setHelloState] = useState<HelloState>({ phase: 'idle' });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current !== null) clearInterval(pollTimer.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const handleHelloClick = useCallback(async () => {
    stopPolling();
    setHelloState({ phase: 'loading' });
    try {
      const helloRes = await fetch(`/api/rooms/${HELLO_ROOM_CODE}/hello`);
      if (!helloRes.ok) throw new Error('hello request failed');
      const status = (await helloRes.json()) as HelloStatus;

      if (status.alarmFiredAt !== null) {
        setHelloState({ phase: 'done', status });
        return;
      }

      const startedAt = Date.now();
      setHelloState({ phase: 'polling', status, startedAt });

      pollTimer.current = setInterval(async () => {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopPolling();
          return;
        }
        try {
          const statusRes = await fetch(`/api/rooms/${HELLO_ROOM_CODE}/status`);
          if (!statusRes.ok) throw new Error('status request failed');
          const nextStatus = (await statusRes.json()) as HelloStatus;
          setHelloState((prev) =>
            prev.phase === 'polling'
              ? { phase: 'polling', status: nextStatus, startedAt: prev.startedAt }
              : prev,
          );
          if (nextStatus.alarmFiredAt !== null) {
            stopPolling();
            setHelloState({ phase: 'done', status: nextStatus });
          }
        } catch {
          stopPolling();
          setHelloState({ phase: 'error' });
        }
      }, POLL_INTERVAL_MS);
    } catch {
      setHelloState({ phase: 'error' });
    }
  }, [stopPolling]);

  const renderHelloStatus = () => {
    switch (helloState.phase) {
      case 'idle':
      case 'loading':
        return null;
      case 'error':
        return <p role="alert">{t('hello.error')}</p>;
      case 'polling': {
        const { status, startedAt } = helloState;
        return (
          <div>
            <p>{t('hello.count', { count: status.count })}</p>
            <p>{t('hello.alarmPending')}</p>
            <p aria-hidden="true">{Math.floor((Date.now() - startedAt) / 1000)}</p>
          </div>
        );
      }
      case 'done': {
        const { status } = helloState;
        const seconds =
          status.alarmSetAt !== null && status.alarmFiredAt !== null
            ? Math.round((status.alarmFiredAt - status.alarmSetAt) / 1000)
            : 0;
        return (
          <div>
            <p>{t('hello.count', { count: status.count })}</p>
            <p>{t('hello.alarmFired', { seconds })}</p>
          </div>
        );
      }
    }
  };

  return (
    <main>
      <h2>{t('hello.heading')}</h2>
      <button
        type="button"
        onClick={() => {
          void handleHelloClick();
        }}
        disabled={helloState.phase === 'loading' || helloState.phase === 'polling'}
      >
        {t('hello.button')}
      </button>
      {renderHelloStatus()}
    </main>
  );
}
