// App shell (M3 rework): header with locale switcher + hash routing (no
// router dependency, see router.ts). '#/' home, '#/room/CODE' room screen,
// '#/debug' the M0 connectivity demo (kept reachable per PLAN §9 G-ALARM).
// The shell carries the design system (app.css): lacquer page, quiet ivory
// wordmark, corner locale control; each page renders its own centered
// content column (.app-main), which the table screen widens.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { LOCALE_SELF_LABELS, SUPPORTED_LOCALES } from './config';
import type { Locale } from './config';
import { getLocale, setLocale, subscribe, t } from './i18n';
import { useRoute } from './router';
import { versionSignal } from './version';
import { DebugPage } from './DebugPage';
import { HomePage } from './HomePage';
import { RoomPage } from './RoomPage';
import './app.css';

function useLocale(): Locale {
  const [locale, setLocaleState] = useState<Locale>(getLocale());
  useEffect(() => subscribe(() => setLocaleState(getLocale())), []);
  return locale;
}

/** Version-skew banner (M4): shell-level so the staleness fact outlives any
 *  one room, role="status" like the disconnected banner (informational, not
 *  an error). Never a modal, never blocks input, and the ONLY reload is the
 *  user clicking the button — the copy can promise the game survives it
 *  because seat tokens + lastSeenSeq persist in localStorage. */
function UpdateBanner() {
  const available = useSyncExternalStore(versionSignal.subscribe, versionSignal.updateAvailable);
  if (!available) return null;
  return (
    <div className="app-alert app-update" role="status">
      <p>{t('app.updateAvailable')}</p>
      <div className="app-update__actions">
        <button type="button" className="app-update__reload" onClick={() => window.location.reload()}>
          {t('app.updateReload')}
        </button>
        <button type="button" className="app-update__later" onClick={() => versionSignal.dismiss()}>
          {t('app.updateLater')}
        </button>
      </div>
    </div>
  );
}

export function App() {
  const locale = useLocale();
  const route = useRoute();

  useEffect(() => {
    document.title = t('app.title');
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-wordmark">
          <a href="#/">{t('app.title')}</a>
        </h1>
        <nav className="app-locale" aria-label={t('locale.label')}>
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              disabled={l === locale}
              onClick={() => setLocale(l)}
            >
              {LOCALE_SELF_LABELS[l]}
            </button>
          ))}
        </nav>
      </header>
      <UpdateBanner />
      {route.page === 'home' && <HomePage />}
      {route.page === 'room' && <RoomPage key={route.code} code={route.code} />}
      {route.page === 'debug' && <DebugPage />}
    </div>
  );
}
