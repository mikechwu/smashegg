import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { clientBuild } from './version';

// Boot log for the M4 redeploy drill and future bug reports: which bundle
// is this tab actually running?
console.info('[smashegg] build', clientBuild());

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
