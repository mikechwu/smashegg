# Image-generation options reachable from our tooling

**Researched 2026-07-16** (all fetch dates below are 2026-07-16). Purpose: the deck-theme
round asked whether we can generate style-reference/exploration images from our own tooling,
at what cost, and with what licensing implications for this MIT repo. The build does NOT
depend on this — the owner's five reference images are the working set; this records the
options. Spot-checked 2026-07-16: `codex features list` confirms `image_generation stable
true` on codex-cli 0.144.1 locally.

## 1. Codex CLI — CAN generate images today (VERIFIED)

- Local binary: codex-cli 0.144.1, authenticated via ChatGPT login.
- `codex --help` / `codex exec --help`: the only image-related FLAG is `-i, --image <FILE>...`
  (input attachment only). No generate subcommand.
- BUT `codex features list` shows `image_generation  stable  true` — generation is a
  model-side tool, not a CLI flag, and it is enabled on this install.
- Official docs: image generation in Codex uses **gpt-image-2**, invoked by describing the
  image or including `$imagegen` in the prompt; reference images attach via `-i/--image`.
  Counts toward general Codex usage limits (drains them "3-5x faster on average"); set
  OPENAI_API_KEY to pay API rates for larger batches.
  Sources: https://learn.chatgpt.com/docs/image-generation ;
  https://learn.chatgpt.com/docs/codex/cli (both fetched 2026-07-16).
- Net: generation AND input both work at $0 marginal cost under the existing login, within
  plan limits.

## 2. OpenAI API image generation (VERIFIED)

- Current models: gpt-image-2 (latest, Codex default), gpt-image-1.5, gpt-image-1,
  gpt-image-1-mini. DALL-E models retired.
- Cost at 1024x1536 per image: gpt-image-2 low $0.005 / medium $0.041 / high $0.165;
  gpt-image-1-mini $0.006/$0.015/$0.052; gpt-image-1.5 $0.013/$0.05/$0.20.
  Sources: https://developers.openai.com/api/docs/guides/image-generation ;
  https://developers.openai.com/api/docs/pricing (fetched 2026-07-16).
- Licensing (verified via Wayback snapshot dated 2026-07-01; openai.com 403'd direct fetch):
  Terms of Use assign output ownership to the user ("you ... own the Output. We hereby assign
  to you all our right, title, and interest, if any, in and to Output."). Restrictions: do not
  represent output as human-generated; do not use output to build competing models.
  Source: https://openai.com/policies/row-terms-of-use/ (via web.archive.org).
- MIT-repo implication: ownership assignment is compatible with MIT-licensing the files; note
  AI provenance in the repo. Caveat: purely AI-generated images may carry thin/no copyright,
  so MIT grants only whatever rights exist — harmless for style references.

## 3. Google Gemini image generation (VERIFIED, no free API tier)

- Models: gemini-3.1-flash-lite-image, gemini-3.1-flash-image, gemini-3-pro-image,
  gemini-2.5-flash-image (legacy), Imagen 4. All outputs carry an invisible SynthID watermark.
  Source: https://ai.google.dev/gemini-api/docs/image-generation (fetched 2026-07-16).
- Free tier: pricing page marks image generation "Not available" on the free tier for all
  image models — no $0 API path. Paid: ~$0.02-0.067/image depending on model.
  Source: https://ai.google.dev/gemini-api/docs/pricing (fetched 2026-07-16). Free interactive
  generation inside the AI Studio web app: UNCERTAIN (not verified this pass).
- Licensing: user owns outputs; unpaid-tier prompts/outputs are used to improve Google
  products. Source: https://ai.google.dev/gemini-api/terms (fetched 2026-07-16).

## 4. Local free option on this machine — NOT PRACTICAL (VERIFIED for the blockers)

This is an Intel x86_64 Mac (i9-9880H, checked locally), which rules out the Apple-Silicon
local stack: MLX targets Apple silicon only (https://github.com/ml-explore/mlx, fetched
2026-07-16), so mflux/DiffusionKit Flux/SD runners are out. Draw Things' fast path targets
M-series (Intel viability UNCERTAIN — https://apps.apple.com/us/app/draw-things-ai-generation/id6444050820,
fetched 2026-07-16). PyTorch shipped its last macOS x86_64 binaries with 2.2.x (Jan 2024;
https://dev-discuss.pytorch.org/t/pytorch-macos-x86-builds-deprecation-starting-january-2024/1690,
fetched 2026-07-16), so a modern SD/SDXL/Flux env will not pip-install cleanly, and CPU-only
SD 1.5 on this hardware runs minutes per image below gpt-image-2's $0.005 tier. Verdict: no
practical local option.

## 5. Anthropic/Claude (VERIFIED)

No image generation — image understanding only.
Source: https://platform.claude.com/docs/en/build-with-claude/vision FAQ (fetched 2026-07-16).

## Recommendation

The five owner references remain the default working set (the null option stands — nothing
obligates generating more). If a style-exploration gap appears, the one genuinely reachable
$0-marginal path is the already-installed, already-authenticated Codex CLI with its stable
image_generation feature (gpt-image-2), attaching the owner references via `-i` — noting it
drains plan limits 3-5x faster, so batches stay small, with API pricing (~$0.041/image medium)
as overflow. Gemini has no free API tier and watermarks outputs; local generation is ruled out
on this Intel Mac. Licensing is clean for the MIT repo under OpenAI's terms provided AI
provenance is noted for generated files.
