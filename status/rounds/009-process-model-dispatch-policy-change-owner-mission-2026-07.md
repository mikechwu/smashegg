> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Process: model dispatch policy change (owner mission, 2026-07-14)

Opus replaces Fable as the default hard tier from M4 on; Fable is
escalation-only on logged demonstrated need (policy text: PLAN §9; ladder
rule: METHODOLOGY; verified mechanism + sources: docs/research/
model-dispatch.md). Applied as committed repo-level `.claude/settings.json`
(`"model": "opus"` — project settings override the user default; subagents
inherit unless a per-invocation model is stated). **Sanity-checked live**
(owner §5): three probe subagents self-reported Haiku 4.5 (explicit haiku),
Opus 4.8 (explicit opus), and Fable 5 (no param — inherit from this
still-Fable session), confirming both that explicit routing works and why
unannotated calls are banned while a Fable session is live. Honest caveats:
(a) the project `model` setting is read at session start — this running
session stays on Fable; the next session in this repo starts on Opus (the
startup header names the settings file, per docs); (b) the M4 implementation
workflow already in flight was launched pre-policy with inherited-Fable
agents — allowed to finish rather than restarted (M4 is the last scheduled
hard-tier milestone; a restart would cost more than it saves); all
subsequent dispatch follows the new ladder.
