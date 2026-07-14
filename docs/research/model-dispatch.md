# Model dispatch: mechanism research + policy record

Dated 2026-07-14 (all sources fetched this date). Owner mission: from M4 on,
Opus replaces Fable as the default hard tier; Fable is escalation-only. Per
METHODOLOGY practice 1 (research over memory — model configuration is
time-sensitive), the mechanism below was verified against the current
official docs before anything was changed. Installed Claude Code: **v2.1.208**
(`claude --version`), above every version floor cited below.

## Verified mechanism (per claim: VERIFIED unless tagged)

1. **Settings hierarchy.** Precedence highest→lowest: managed → CLI args →
   `.claude/settings.local.json` (local, git-ignored) → `.claude/settings.json`
   (project, **explicitly designed to be committed to git**) →
   `~/.claude/settings.json` (user). A project-level `model` therefore
   overrides a user-global one for every session in this repo.
   Source: https://code.claude.com/docs/en/settings (note: docs.claude.com
   URLs now 301 to code.claude.com).
2. **`model` setting values.** Accepts a model alias or a full model ID; the
   `fable` alias in settings requires v2.1.170+. The setting is read once at
   session start (mid-session switching is `/model`). Aliases track the
   provider's recommended version over time (`opus` → Opus 4.8 on the
   Anthropic API today); pin a full ID only when snapshot stability matters.
   Source: https://code.claude.com/docs/en/model-config. Version floors:
   Opus 4.8 needs v2.1.154+, Sonnet 5 needs v2.1.197+.
3. **Current model IDs** (Anthropic API): `claude-fable-5` ($10/$50 per
   MTok), `claude-opus-4-8` ($5/$25), `claude-sonnet-5` ($3/$15; intro
   $2/$10 through 2026-08-31), `claude-haiku-4-5-20251001` (alias
   `claude-haiku-4-5`, $1/$5). Docs recommend Opus 4.8 "for complex agentic
   coding"; Fable 5 is "not the default model" even upstream.
   Source: https://platform.claude.com/docs/en/about-claude/models/overview.
4. **Subagents inherit by default.** The subagent frontmatter `model` field
   accepts `sonnet`/`opus`/`haiku`/`fable`, a full ID, or `inherit`;
   **omitted ⇒ `inherit`** — a subagent runs on the main session's model
   unless explicitly overridden per definition or per invocation. The Agent
   tool and workflow `agent()` calls accept a per-invocation `model`
   parameter (same alias set). Source:
   https://code.claude.com/docs/en/sub-agents ("Choose a model").
5. **`CLAUDE_CODE_SUBAGENT_MODEL`** forces ONE model for all subagents,
   agent teams, and workflow agents, overriding even per-invocation
   parameters. **Rejected for our policy**: tiered dispatch needs
   per-invocation choice; a global override would flatten the ladder (and
   silently defeat deliberate Haiku/Sonnet downgrades and Fable
   escalations). Source: https://code.claude.com/docs/en/model-config
   (environment variables table).
6. **`availableModels`** can allowlist models across main session, subagents
   and skills. **Rejected**: Fable must stay selectable for the
   escalation-only path; the policy is a default, not a ban.
7. Built-in Explore agents inherit the main model **capped at Opus** on the
   Anthropic API (v2.1.198+) — consistent with the policy for free.
8. UNCERTAIN (not needed for the policy): whether a project-settings `model`
   change is picked up by an already-running session on its next request —
   the docs say "read once at session start"; we treat it as
   restart-to-apply, and the docs note the startup header names the settings
   file that set the model, which is the owner-visible confirmation.

## The applied configuration

- **`.claude/settings.json` (committed):** `{ "model": "opus" }` — every new
  session in this repo defaults to Opus-class; subagents and workflow agents
  then inherit Opus unless a per-invocation parameter says otherwise.
  `.gitignore` switched from `.claude/` to `.claude/*` + a negation, because
  git cannot re-include a file under an excluded directory.
- **Per-invocation tiering (orchestrator discipline):** Haiku for trivial,
  Sonnet for standard (most UI/polish from M5 on), Opus for hard; **Fable
  only on a logged, demonstrated-need escalation** (see PLAN §9 for the
  policy text and triggers). While any session still runs ON Fable (e.g. the
  owner's user-level default before this change, or a deliberate
  escalation), inheritance would silently route subagents to Fable — so
  agent invocations state an explicit model rather than relying on inherit.
- The cross-model audit panel (Codex + Grok primary, Gemini fallback) is
  unaffected — lineage diversity is not a budget lever.
