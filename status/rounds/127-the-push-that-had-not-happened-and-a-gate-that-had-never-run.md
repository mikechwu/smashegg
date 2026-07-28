> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The push that had not happened, and a browser gate that had never run

Owner word: *"push and do not deploy straight to Cloudflare. otherwise the state will be inconsistent."*

**Routing.** None. Everything here is a reproduction against the real pipeline: the failures were observed on the runner, the diagnoses confirmed locally, and each fix mutant-verified. A second opinion on "did this step ever work" is worth less than the run log that says it did not.

### 1. The deploy was real; the push was not

| | at the moment the owner asked |
|---|---|
| live build (`/api/health`) | `61d5455` |
| local `HEAD` | `caf6671` |
| `origin/main` | `f0103ee` — **2026-07-26, 48 commits back** |

`npm run deploy` publishes the working tree straight to Cloudflare and never touches GitHub. So the card change was genuinely live and correct — the commit on top of the deployed one has a zero-line `src/` diff — while the entire J-through-P arc existed on no remote. For two days production ran a commit that would have been unrecoverable if the laptop had been.

**The recorded reason was wrong, and it is the wording that hid it.** Round 126 and its commit message both say `health build == pushed HEAD`. The comparison behind that sentence was against **local** HEAD. It passed, truthfully; the noun was false. A true check reported with a wrong word is invisible in exactly the way a failing check is not, and this project has now spent a round on it. The correction lives here and in `CURRENT.md` — the round file itself stays as written, which is what history files are for.

**The policy is now the workflow.** Push to `main` is the deploy. `README.md` says so, with the reason and with the narrow emergency exception. `docs/audits/M4-grok.md` had already called any non-workflow deploy the *"highest practical risk"* — for the adjacent reason, a hand-run `build` + `deploy` mismatching SHAs and permanently silencing the update banner. That specific defect was fixed at M4 and `npm run deploy` does pair one SHA across both. The residual is the one the owner named, and it is not the one the audit named.

### 2. The first push in two days turned the pipeline red, twice, for two defects that had never been exercised

Both are the same shape: **a check that could not pass, kept invisible by a check that failed earlier.**

**[a] A test that asserted developer-machine state.** `commit-gate.test.ts` required `core.hooksPath === '.githooks'`. That is per-clone LOCAL git config; a runner checks out fresh and never runs `npm run hooks`. Added 2026-07-27 — one day after the last push — so the first CI run that ever saw it was this one, and it took down CI and Deploy together at step 7 of 13.

Split by what each environment can prove. New and everywhere: the hook is executable **in the index** (mode 100755) — the on-disk bit previously checked is one machine's, and a clone receiving 100644 cannot run the hook however correctly `core.hooksPath` points at it. Developer clones only: the arming. A runner cannot commit, so it has no commit to gate, and both workflows run the suite and typecheck as their own steps regardless.

What no environment asserts is that a given developer **has** armed the hook. That is unprovable from inside CI by construction, and is now stated rather than faked by a check that was simply wrong on half the machines running it.

**[b] A browser gate that had never once run.** With the suite green, CI reached the containment gate for the first time and died on `ERR_MODULE_NOT_FOUND: playwright`.

`playwright install --with-deps chromium` fetches **browser binaries and nothing else**. The gate script's first act is `await import('playwright')`. The step reported success and left the gate impossible. Two things make it a good decoy: the command is named *install*, and `NODE_PATH` — the reflex fix — is ignored by Node for ESM imports, so the usual escape hatch does not exist.

Added 2026-07-27 in this same arc. Every green CI before it predates the step. The two runs after it **skipped** it behind defect [a] — and a skipped step is not a signal anyone reads.

Fix: install the package too, `--no-save`. That flag is load-bearing rather than tidy — playwright is deliberately absent from `package.json` because the measurement gates are manual, and a saved install would put it back and hand the next `npm ci` a browser driver nobody asked for.

### 3. The red was the harness, not the layout — established before the fix, not after

Before patching anything the gate was run locally at CI's exact viewport list — `390x664` through `2478x1400`, ten viewports, no shelf and one shelf — using the documented symlink-from-npx-cache method. **PASS**, 20 probes, 3520 element boxes. So the arc's shipped card was never implicated and the fix was known to be a harness fix before it was written.

The order matters. Patching first and reading a green as vindication would have conflated "the gate can now run" with "the gate is happy", and those are different claims that a single green cannot separate.

### 4. What the runner then found that no local run had

CI's containment gate, on its first-ever execution: **30 probes, 5280 element boxes, PASS**, desk title clean at 30 titles.

And the assertion that has been reporting nothing for two rounds finally reported something. **The card-frame case staged a joker on 10 probes** — present and clean. The P1 pre-flight's seven-width run staged zero and said so; the local reproduction above staged zero and said so. The runner's ten desktop viewports carried it. The non-vacuity guard was right three times running: twice that it proved nothing, once that it proved something.

### 5. The mechanisms, because a fix without one is the lapse

- `workflow-playwright.test.ts` enumerates scripts importing playwright, finds every workflow invoking one, and requires a **package** install at an earlier character offset. Textual and offset-based rather than a YAML parse: no YAML parser is a dependency, and playwright's absence from the manifest is the constraint under test, so adding one to check it would be self-defeating. Non-vacuity floor on both sets. Mutant-verified on all three assertions — the original broken step, an install ordered after the gate, an install missing `--no-save`.
- `ci.yml` asserts in-workflow that `import('playwright')` resolves and exports `chromium`. An install that succeeds while leaving the import unresolvable is precisely the failure above, so resolution is asserted rather than assumed.
- The index-mode assertion in `commit-gate.test.ts`, mutant-verified via `update-index --chmod=-x`.

### 6. METHODOLOGY

**Practice 38: a skipped step is not a passing step, and nothing in a run summary distinguishes them.** Both defects here were invisible for the same reason — an earlier red left them unexecuted, and a job that stops at step 7 says nothing about steps 8 through 13. The operational rule: when a job goes red, read what it *skipped* as unknown rather than as fine, and expect the next green to expose a second defect rather than confirm one fix.

**Practice 39: a check whose subject is the developer's machine is not a test of the repository.** `core.hooksPath` was the instance; the general form is any assertion over local config, installed tooling, or a path outside the tree. It passes for whoever wrote it and cannot pass anywhere else, which reads as environmental flakiness rather than as the design error it is. Ask what the assertion's subject is: if the answer is "this laptop", it belongs behind an environment condition with the portable half split out and kept.

**And the smaller one, on wording.** `health build == pushed HEAD` was a true comparison described with a false noun, and the falseness survived review precisely because the check was green. When recording a verification, name the three values separately — live, `origin/main`, local `HEAD` — rather than asserting a relation between two of them under a name that implies a third.

### 7. Open

Nothing. Live, `origin/main` and local `HEAD` are all `ce298fc`. CI is green across all 13 steps for the first time since the containment gate was added. The comms owed in round 126 are still the owner's to send.
