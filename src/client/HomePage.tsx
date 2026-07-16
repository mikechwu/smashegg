// '#/' home screen (M3 shell): create a room (game fixed to DEFAULT_GAME_ID
// — a config constant, not a hardcoded id) or join an existing one by code.
// Create-a-room is the hero action; join-by-code is the quiet secondary row.

import { useState } from 'react';
import { ROOM_CODE_RE } from '../shared/protocol';
import { DEFAULT_ROOM_TIMING } from '../shared/timing';
import { DEFAULT_GAME_ID } from './config';
import { t } from './i18n';
import { navigate, roomHash } from './router';
import { assembleConfig, CURATED_DEFAULT_PICKS } from './RulePicker';

type CreateState = 'idle' | 'creating' | 'failed';

export function HomePage() {
  const [createState, setCreateState] = useState<CreateState>('idle');
  const [joinCode, setJoinCode] = useState('');
  const [joinInvalid, setJoinInvalid] = useState(false);

  const handleCreate = async () => {
    setCreateState('creating');
    try {
      // Rooms are created with the FULL owner-default config up front
      // (GuandanGame.init rejects a null config at start), assembled by the
      // same function the lobby rule-picker uses — so what the picker
      // displays is exactly what the room carries from birth.
      // CURATED_DEFAULT_PICKS pins firstLeadMethod='drawCard' (the PRODUCT
      // default: created rooms show the draw ceremony (flip-to-lead) opening); the
      // engine-spec default stays 'random'. Timing follows the same rule:
      // DEFAULT_ROOM_TIMING is sent explicitly (the server would default it
      // anyway) so the product default is client-visible like the config.
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gameId: DEFAULT_GAME_ID,
          config: assembleConfig(CURATED_DEFAULT_PICKS),
          timing: DEFAULT_ROOM_TIMING,
        }),
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
    <main className="app-main">
      <section className="home-hero">
        <p className="home-tagline">{t('app.tagline')}</p>
        <h2>{t('home.createHeading')}</h2>
        <button
          type="button"
          className="btn-primary home-create"
          onClick={() => {
            void handleCreate();
          }}
          disabled={createState === 'creating'}
        >
          {createState === 'creating' ? t('home.creating') : t('home.createButton')}
        </button>
        {createState === 'failed' && (
          <p className="app-alert" role="alert">
            {t('home.createFailed')}
          </p>
        )}
      </section>
      <section className="home-join">
        <h2>{t('home.joinHeading')}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoin();
          }}
        >
          <label>
            {t('home.codeLabel')}
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t('home.codePlaceholder')}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <button type="submit">{t('home.joinButton')}</button>
        </form>
        {joinInvalid && (
          <p className="app-alert" role="alert">
            {t('home.invalidCode')}
          </p>
        )}
      </section>
    </main>
  );
}
