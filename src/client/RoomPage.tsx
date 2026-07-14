// '#/room/CODE' screen (M3 shell): owns the RoomStore + RoomConnection
// lifecycle for one room and picks lobby vs. table by room.status. An
// existence check via GET /api/rooms/:code runs first so a mistyped code
// gets a clear answer instead of a socket endlessly retrying against a 404.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { RoomConnection } from './room/connection';
import { RoomStore } from './room/store';
import { GameTable } from './GameTable';
import { Lobby } from './Lobby';
import { t } from './i18n';

type RoomCheck = 'checking' | 'ok' | 'notFound' | 'error';

export interface RoomPageProps {
  code: string;
}

export function RoomPage({ code }: RoomPageProps) {
  const [check, setCheck] = useState<RoomCheck>('checking');
  const store = useMemo(() => new RoomStore(code), [code]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    let cancelled = false;
    setCheck('checking');
    void (async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`);
        if (cancelled) return;
        setCheck(res.ok ? 'ok' : res.status === 404 ? 'notFound' : 'error');
      } catch {
        if (!cancelled) setCheck('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (check !== 'ok') return;
    // The connection binds itself as the store's sender; closing it stops
    // reconnection attempts and the keepalive (StrictMode's double-mount
    // simply opens a fresh connection, which the DO handles as a takeover).
    const connection = new RoomConnection(store);
    return () => connection.close();
  }, [check, store]);

  if (check === 'checking') return <main>{<p>{t('room.loading')}</p>}</main>;
  if (check === 'notFound' || check === 'error') {
    return (
      <main>
        <p role="alert">{check === 'notFound' ? t('room.notFound') : t('room.loadFailed')}</p>
        <a href="#/">{t('room.backHome')}</a>
      </main>
    );
  }

  const lastRejection = snapshot.rejections[snapshot.rejections.length - 1];

  return (
    <main>
      <h2>{t('room.codeLabel', { code })}</h2>
      <p>{snapshot.connected ? t('room.statusConnected') : t('room.statusDisconnected')}</p>
      {lastRejection !== undefined && (
        <p role="alert">{t('room.rejected', { code: lastRejection.error.code })}</p>
      )}
      {snapshot.room === null ? (
        <p>{t('room.connecting')}</p>
      ) : snapshot.room.status === 'lobby' ? (
        <Lobby snapshot={snapshot} store={store} />
      ) : (
        // 'playing' and 'finished' both render the table: final views stay
        // visible at game end (the table task adds a results treatment).
        <GameTable snapshot={snapshot} />
      )}
    </main>
  );
}
