// App shell (M3 rework): header with locale switcher + hash routing (no
// router dependency, see router.ts). '#/' home, '#/room/CODE' room screen,
// '#/debug' the M0 connectivity demo (kept reachable per PLAN §9 G-ALARM).
// The shell carries the design system (app.css): lacquer page, quiet ivory
// wordmark, corner locale control; each page renders its own centered
// content column (.app-main), which the table screen widens.

import { useEffect, useState } from 'react';
import { SUPPORTED_LOCALES } from './config';
import type { Locale } from './config';
import { getLocale, setLocale, subscribe, t } from './i18n';
import { useRoute } from './router';
import { DebugPage } from './DebugPage';
import { HomePage } from './HomePage';
import { RoomPage } from './RoomPage';
import './app.css';

function useLocale(): Locale {
  const [locale, setLocaleState] = useState<Locale>(getLocale());
  useEffect(() => subscribe(() => setLocaleState(getLocale())), []);
  return locale;
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
              {t(
                l === 'zh-Hant' ? 'locale.zhHant' : l === 'zh-Hans' ? 'locale.zhHans' : 'locale.en',
              )}
            </button>
          ))}
        </nav>
      </header>
      {route.page === 'home' && <HomePage />}
      {route.page === 'room' && <RoomPage key={route.code} code={route.code} />}
      {route.page === 'debug' && <DebugPage />}
    </div>
  );
}
