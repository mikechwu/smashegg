# SETUP — Accounts, Tokens, and Tooling

Each step is marked **[AUTO]** (I can run it from this machine once prerequisites exist) or **[HUMAN]** (requires you clicking in a browser / interactive auth). Verified against official docs 2026-07-13 (sources in [docs/research/cloudflare-facts.md](docs/research/cloudflare-facts.md)); re-check any step that looks different when you get there — dashboards change.

## 1. GitHub

| # | Step | Who |
|---|------|-----|
| 1.1 | GitHub account | **[HUMAN]** — you already have one |
| 1.2 | Create repo (private or public), MIT license | **[AUTO]** via `gh repo create` if `gh auth status` is logged in; otherwise **[HUMAN]** one-time `gh auth login` |
| 1.3 | Add repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | **[AUTO]** via `gh secret set` once the values exist (steps 2.4, 2.5) |

## 2. Cloudflare

| # | Step | Who |
|---|------|-----|
| 2.1 | Free account at dash.cloudflare.com (email verify) | **[HUMAN]** |
| 2.2 | Enable Workers (pick a `*.workers.dev` subdomain when prompted on first visit to Workers & Pages) | **[HUMAN]** — dashboard, one click |
| 2.3 | Local interactive auth: `wrangler login` (opens browser OAuth) | **[HUMAN]** — run `! npx wrangler login` in this session so I can proceed afterward |
| 2.4 | **Account ID**: Workers & Pages overview page, right sidebar | **[HUMAN]** to read it (or **[AUTO]** via `wrangler whoami` after 2.3) |
| 2.5 | **CI API token**: dash.cloudflare.com/profile/api-tokens → Create Token → template **"Edit Cloudflare Workers"** → scope *Account Resources* to your single account → create, copy once | **[HUMAN]** — token creation is dashboard-only. Paste it to me once and I store it with `gh secret set` only (never in the repo) |

## 3. Local tooling

| # | Step | Who |
|---|------|-----|
| 3.1 | Node.js LTS (≥ 20; CI pins 22) — check `node --version` | **[AUTO]** to check; **[HUMAN]** if an install/upgrade is needed (or I can via Homebrew with your OK) |
| 3.2 | Scaffold: `npm create cloudflare@latest` (C3) or hand-rolled per PLAN §2; wrangler v4 as devDependency (`npm i -D wrangler@4`) | **[AUTO]** |
| 3.3 | Durable Object declared in `wrangler.jsonc`: `durable_objects.bindings` + `migrations[0].new_sqlite_classes: ["GameRoom"]` (SQLite backend — the free-plan backend) | **[AUTO]** |
| 3.4 | Local dev: `wrangler dev` (DOs + WebSockets run locally by default in v4) | **[AUTO]** |

## 4. CI/CD

| # | Step | Who |
|---|------|-----|
| 4.1 | `.github/workflows/ci.yml` — PR/push: typecheck, unit, build, e2e | **[AUTO]** |
| 4.2 | `.github/workflows/deploy.yml` — push to `main`: checks → `cloudflare/wrangler-action@v3` (`wranglerVersion: '4'`) → `wrangler deploy` → post-deploy smoke against the live URL | **[AUTO]** |
| 4.3 | Preview deploys for non-main branches (`wrangler versions upload`) — **deferred**: DO-bound Workers share live DO classes across versions (PLAN §9.2); PRs run CI only in MVP | — |

## 5. Optional / later

| # | Step | Who |
|---|------|-----|
| 5.1 | D1 for match history: `wrangler d1 create <name>` + binding + migrations | **[AUTO]** — post-MVP |
| 5.2 | Custom domain on the Worker | **[HUMAN]** — dashboard (domain purchase/DNS) |

## Secrets policy

- Never committed. CI: GitHub Actions secrets only. Local: `.dev.vars` (gitignored; `.dev.vars.example` committed).
- Cloudflare token scope: single account, Workers-edit template only. Rotate from the same dashboard page if ever exposed.
- MVP has no runtime server secrets; if any appear (e.g., admin endpoints), they go in via `wrangler secret put`.

## Critical-path summary for you (everything else is mine)

1. Cloudflare account + Workers subdomain (2.1, 2.2)
2. `! npx wrangler login` in this session (2.3)
3. Create the CI API token in the dashboard and hand it to me once (2.5)
4. If `gh` isn't authenticated: `! gh auth login` (1.2)
