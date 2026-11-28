---
name: zoonk-video
description: Use when asked for a Zoonk product, launch, feature, promo or social video, a silent demo clip or a social post image, or to update one.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Zoonk videos

A Zoonk video shows the real product, says only what the code backs, and ships in both of the brand's languages: global channels in US English, Brazil's in Brazilian Portuguese, each asset in `en-US/` and `pt-BR/`. The studio in this folder renders the app's own components with either locale's catalog and makes three kinds, each with its own steps:

- **A film** (a launch film, a promo, a social cut): captured screens animated in HTML with narration, music and the app's own sounds. Follow [films](references/films.md).
- **A post image:** a stage places live components on a canvas, one in focus and one behind it. Follow [social stills](references/social-stills.md).
- **A silent demo clip:** the same stage in one continuous shot. Follow [feature demos](references/feature-demo.md).

## Set up the studio

Run `node .agents/skills/zoonk-video/scripts/init.mjs <work-dir> [--port 5199]`.

- Use a scratch folder outside the repo and a free port; nothing a video produces is committed.
- It copies the engine, the harness, the scripts and the examples (`films/zoonk-2/`, `films/launch/`), installs GSAP, Lucide and Geist, links the repo's React, Vite, AI SDK and Playwright, and builds the icon and font files.
- Before init, run `node .agents/skills/zoonk-video/scripts/check.mjs` from the repository: CI doesn't check the studio, so app changes since the last video may have broken views. It type-checks every view and renders each one in both languages. Fix what broke in this skill's folder, so the next video starts from a working template, and commit it with the video work.
- Init ends with `npm run typecheck`: every view against the app's current contracts. Fix a drifted view before filming, since it draws wrong numbers. Run it again after pulling.
- [The studio](references/studio.md) maps what init copies (each script, the engine, the harness and the examples) and says how to bring an older studio up to date.
- It needs FFmpeg, Python 3 with NumPy, and the Chromium the repo's E2E tests use (`pnpm exec playwright install chromium`); it stops early if FFmpeg or NumPy is missing.
- Then, in the studio: `npm run harness` (keep it running), and `node scripts/export-art.mjs` for the buddy and Trickster SVGs.

## Rules for every kind

- **Accuracy:**
  - Show the real UI with sample learner data. Don't invent UI, features, labels or rules; when the code and the blog disagree, the code wins.
  - For example:
    - Energy replaces streaks.
    - Brain Power is the XP behind the belts.
    - Phase challenges are 10 questions with 7 to win and +200 Brain Power (`packages/core/src/checkpoints/checkpoint-rules.ts`, `packages/core/src/sessions/brain-power.ts`).
- **Capture hygiene:** don't edit harness files while a capture runs. Vite reloads the page and the frame comes out blank.
- **Bugs found while making one:** start a separate thread with the repro (AGENTS.md), and keep the bug out of the shot.
- **Deliver** where the user asked; the default is `~/Documents/<Video name>/{en-US,pt-BR}/`. Move earlier versions into a `vN (…)` subfolder rather than deleting them.
