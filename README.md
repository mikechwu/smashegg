# smashegg

An online card-table platform. The first game is Guandan (掼蛋), a
four-player partnership climbing/shedding game with tribute rounds and
progressive team levels. Built as a single Cloudflare Worker: static
assets serve the frontend, and a `GameRoom` Durable Object (SQLite-backed,
WebSocket Hibernation) holds each room's authoritative game state. The UI
defaults to Traditional Chinese (zh-Hant), with a runtime language
switcher.

See [PLAN.md](PLAN.md) for the full architecture and design decisions,
[STATUS.md](STATUS.md) for current progress, and [SETUP.md](SETUP.md) for
the account/token setup steps required to deploy. The Guandan rules spec
lives at [docs/rules/guandan.md](docs/rules/guandan.md); the research
methodology behind this project's fact-checking is documented at
[docs/research/METHODOLOGY.md](docs/research/METHODOLOGY.md).

## Quickstart

```sh
npm install
npm run build       # builds the client into dist/client
npm run cf:dev       # runs the Worker + assets + Durable Object locally
```

Other scripts: `npm run dev:client` (Vite dev server, client-only),
`npm run typecheck`, `npm run test` (Vitest unit tests).

### Deploying

**Push to `main`. That is the deploy.** `.github/workflows/deploy.yml` runs the
checks and then `wrangler deploy`, so what is live is always a commit that
exists on the remote.

`npm run deploy` publishes from your working tree straight to Cloudflare without
going near GitHub, which lets the live build drift from `origin/main` — for two
days in July 2026 production ran a commit that existed on no remote and would
have been unrecoverable if the laptop had been. It also skips the containment
gate, which only CI runs. Keep it for an emergency where CI itself is the thing
that is broken, and push as soon as you can afterwards.

(It is at least version-safe: it pairs one SHA across the client build and the
Worker var, which is the `BUILD_VERSION` pairing the M4 audit required. A build
and a deploy run separately by hand is the case that audit called the highest
practical risk — it silences the update banner for those clients permanently.)

## Status: M0 (toolchain skeleton)

This is the M0 milestone: the TypeScript/Vite/React/Cloudflare-Workers
toolchain skeleton, not a playable game yet. There is no Guandan engine,
no lobby, and no table UI here — those land in M1–M3. M0's own scope is a
hello-world Worker that serves static assets and answers through the
`GameRoom` Durable Object in a single deploy, proving two empirical gate
checks named in PLAN.md §9:

- **G-COMPOSE** — one Worker can serve static assets *and* host a Durable
  Object together, in one `wrangler.jsonc` and one deploy.
- **G-ALARM** — a Durable Object alarm fires on the Cloudflare free tier.
