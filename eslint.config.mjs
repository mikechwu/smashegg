// Deliberately narrow lint: ONLY the React hook-order rules, scoped to the
// client. Exists as a ratchet for a specific verified crash class — a hook
// called below a conditional early return renders fine until the condition
// flips mid-session, then throws "Rendered more hooks than during the
// previous render" (found live in GameTable during the deck-theme round;
// the DOM-free unit suite structurally cannot catch it because it never
// re-renders a component across a state transition). Style linting is out
// of scope on purpose.
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['src/client/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    // Pre-existing eslint-disable comments target rules outside this narrow
    // config (exhaustive-deps); don't warn about them here.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
