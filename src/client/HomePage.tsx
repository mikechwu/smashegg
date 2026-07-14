// '#/' home screen (M3 shell): create a room (game fixed to DEFAULT_GAME_ID
// — a config constant, not a hardcoded id) or join an existing one by code.

import { useState } from 'react';
import { ROOM_CODE_RE } from '../shared/protocol';
import { DEFAULT_GAME_ID } from './config';
import { t } from './i18n';
import { navigate, roomHash } from './router';

type CreateState = 'idle' | 'creating' | 'failed';

export function HomePage() {
  const [createState, setCreateState] = useState<CreateState>('idle');
  const [joinCode, setJoinCode] = useState('');
  const [joinInvalid, setJoinInvalid] = useState(false);

  const handleCreate = async () => {
    setCreateState('creating');
    try {
      // Config starts null: the lobby's rule picker (a later M3 task) edits
      // it live via setConfig; the server treats it as opaque (PLAN §4) and
      // the game's init applies its defaults to a null config at start.
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId: DEFAULT_GAME_ID, config: null }),
      });
      if (res.status !== 201) throw new Error('createRoom failed');
      const body = (await res.json()) as { code: string };
      navigate(roomHash(body.code));
    } catch {
      setCreateState('failed');
    }
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!ROOM_CODE_RE.test(code)) {
      setJoinInvalid(true);
      return;
    }
    setJoinInvalid(false);
    navigate(roomHash(code));
  };

  return (
    <main>
      <section>
        <h2>{t('home.createHeading')}</h2>
        <button
          type="button"
          onClick={() => {
            void handleCreate();
          }}
          disabled={createState === 'creating'}
        >
          {createState === 'creating' ? t('home.creating') : t('home.createButton')}
        </button>
        {createState === 'failed' && <p role="alert">{t('home.createFailed')}</p>}
      </section>
      <section>
        <h2>{t('home.joinHeading')}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoin();
          }}
        >
          <label>
            {t('home.codeLabel')}{' '}
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder={t('home.codePlaceholder')}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <button type="submit">{t('home.joinButton')}</button>
        </form>
        {joinInvalid && <p role="alert">{t('home.invalidCode')}</p>}
      </section>
    </main>
  );
}
