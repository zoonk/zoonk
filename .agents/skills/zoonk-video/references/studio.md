# The studio

What's in this skill's folder, which `init.mjs` copies into a studio, and how to bring an older studio up to date.

## Running init again

Running init again over a studio adds what's missing and never overwrites a file. A studio made before the stage has no `typecheck`, and init stops there: make a fresh folder and copy its `films/` across.

## Checking the template

Run `node .agents/skills/zoonk-video/scripts/check.mjs` from the repository after installing dependencies and generating the Prisma client. It prepares a fresh studio, runs the same type check as init, then opens each default view at phone width in English and Portuguese with the checkout's Playwright Chromium. It doesn't install film dependencies or call AI services. CI doesn't run it, so run it at the start of every video and fix what app changes broke.

## Files

Paths are relative to the skill's folder.

- `scripts/`
  - Setup: `init.mjs` builds a studio; `check.mjs` checks the template; `typecheck.mjs` checks the views in an existing studio; `export-art.mjs` saves the buddy SVGs.
  - Captures: `snap.mjs` (stills), `seq.mjs` (interactions), `typing.mjs`, `manifests.py`; `story-clock.mjs` pins their clock to the story's date.
  - Video: `render.mjs` turns a page or a stage scene (`--url`, `--scheme dark`) into an MP4 or stills, failing a stage frame that cuts what it shows; `stills.mjs` renders a set's post images in every size, scheme and language; `cues.mjs` lists a page's sound cues.
  - Audio: `narration.py` (spec, fit and captions); `gen-audio.mjs`, `transcribe.mjs`, `judge-audio.mjs` and `rank-audio.mjs` (AI Gateway); `mix.py` and `sfx.py` (the mix and the UI sounds).
- `engine/`: the page runtime.
  - `engine.js`: the timeline, the frame-exact seek, text reveals, typing and sound cues.
  - `kit.js`: scenes, text, cards, the phone, and real-screen stills, sequences, taps and auto-fit.
  - `common.css`: Zoonk's tokens and the base styles.
- `realui/`: the harness that renders app components outside Next.
  - The Vite config, which compiles translations with next-intl's own loaders, as Main's build does.
  - Views for the player (`player.tsx`), the learn screens (`learn/`) and the goal screens (`goals/`).
  - `art.tsx`: the brand art.
  - `story.ts`: the films' sample learner per locale.
  - `learners/`: the stage's sample learners, built into the app's view models with no `any`.
  - `stage/`: the stage page, its kit and the catalog of pieces (`pieces.ts`).
- `example/zoonk-2/`: the 2.0 launch film, to copy for a new one: pages (`long`, `short`, `thumb`), `copy.js` (the words per language), `stills.json` (the screens to capture), `narration.py` and `music.json`.
- `example/launch/scenes.ts`: the 2.0 launch stills and the goal-to-plan demo.
