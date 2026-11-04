---
name: zoonk-video
description: Make Zoonk product videos (launch films, feature promos, social cuts) in US English and Brazilian Portuguese from the app's real screens. Covers the story taken from the code, the real components rendered outside Next in either language, motion from a frame-exact renderer, narration and music generated through AI Gateway, and MP4s ready for YouTube, Reels and TikTok. Use when asked for a product, launch, feature, promo or social video, or to update one.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Zoonk videos

A Zoonk video shows the real product, says only what the code backs, and ships in both of the brand's languages. The studio in this folder covers each step:

- **Real screens:** renders the app's own components with either locale's catalog.
- **Animation:** animates them in HTML with GSAP, then captures every frame from a paused timeline, so nothing depends on how fast the machine is.
- **Sound:** mixes narration, music and the app's own sounds.

## Workflow

1. **Brief.** Settle the formats, length and channels with [formats](references/formats.md).
   - Zoonk posts on two channel sets: global in US English, Brazil in Brazilian Portuguese.
   - Every asset ships in both languages: `en-US/` and `pt-BR/`, each with the video files, the YouTube thumbnail, `post-copy.md` and the `.srt` captions.
2. **Story from the code.** Follow [story](references/story.md).
   - Use the blog for inspiration, never as the source.
   - Check every claim, number and label against `packages/core`, the components and the `.po` catalogs.
   - Take goals per locale from the landing page's example sets.
   - Write the plan as a scene table with the text for both languages side by side, and get it approved before building.
3. **Studio.** Run `node .agents/skills/zoonk-video/scripts/init.mjs <work-dir>`.
   - Use a scratch folder outside the repo; nothing a video produces is committed.
   - It copies the engine, the harness, the scripts and the example film (`films/zoonk-2/`), installs GSAP, Lucide and Geist, links the repo's React, Vite, AI SDK and Playwright, and builds the icon and font files.
   - It needs FFmpeg, Python 3 with NumPy, and the Chromium the repo's E2E tests use (`pnpm exec playwright install chromium`); it stops early if FFmpeg or NumPy is missing.
   - Then, in the studio: `npm run harness` (keep it running), and `node scripts/export-art.mjs` for the buddy and Trickster SVGs.
4. **Real screens.** Follow [real screens](references/real-screens.md).
   - Build each view from the real component with the story's data per locale.
   - Capture the film's stills (`snap.mjs <film>/stills.json`), interaction sequences (`seq.mjs`) and the typed goal (`typing.mjs`) at 3×, then run `manifests.py`.
   - Look at every PNG in both languages.
   - Delegate groups of screens to helpers when there are many. Each helper owns its own views file.
5. **Scenes.** Write the film in `<work-dir>/films/<film>/`, with the example as the template.
   - Every line of copy goes in `copy.js`, per language.
   - Timing uses the bar grid of the soundtrack. Composition and pace follow [story](references/story.md#composition).
   - Render storyboard stills (`render.mjs --stills all --every 2`) and review them as contact sheets before any full render.
6. **Sound.** Follow [audio](references/audio.md).
   - Narration goes through AI Gateway in the same voice for both languages. Each line is fitted to its scene, transcribed back and judged.
   - The music bed is composed for the film's length and held at one level.
   - UI sounds are the app's own.
   - The mix lands at −14 LUFS.
7. **Render and verify.**
   - Render each cut at final quality with its mix (`render.mjs --audio`):
     - YouTube at 4K60.
     - Vertical at 1080×1920 60 fps, rendered at 2× and downscaled.
   - Check:
     - ffprobe: H.264 High, BT.709 tags, 60 fps.
     - Loudness: −14 LUFS, −1.5 dBTP.
     - A decode pass with no errors.
     - Frames sampled across the video and at every transition.
   - Fix, then re-render only what changed. When only the sound changed, remux the new mix instead of re-rendering.
8. **Deliver.**
   - Put the files where the user asked; the default is `~/Documents/<Video name>/{en-US,pt-BR}/`, which syncs through iCloud.
   - Move earlier versions into a `vN (…)` subfolder rather than deleting them.
   - Report what you verified and what you could not: you can't listen, so the judge stands in.

## Rules that save a redo

- **Accuracy:**
  - Show the real UI with sample learner data. Don't invent UI, features, labels or rules; when the code and the blog disagree, the code wins.
  - For example:
    - Energy replaces streaks.
    - Brain Power is the XP behind the belts.
    - Phase challenges are 10 questions with 7 to win and +200 Brain Power (`packages/core/src/checkpoints/checkpoint-rules.ts`, `packages/core/src/sessions/brain-power.ts`).
- **Locales:**
  - Keep every line of copy in `copy.js` and every learner value in `realui/story.ts`, per locale; scenes and views only read keys.
  - Headlines break only at `<br>` and shrink to fit (`K.fit`), so Portuguese never wraps by surprise.
- **One focal point:** in 16:9 a beat is the headline alone, then the phone alone, framed on the part the voice describes; never text beside the phone. See [composition](references/story.md#composition).
- **Pace:**
  - Hold each line for about 0.28 s per word plus 0.6 s.
  - No empty frames at cuts.
  - Keep one phone on screen while its screens change, instead of a new phone rising for every beat.
- **Audio:** hold one level. Only lower the music under the voice, never by section.
- **Vertical:**
  - Keep text and the CTA inside x 120–960, y 270–1250.
  - Brand on screen from frame 0.
  - The last frame matches the first, so the video loops.
- **Capture hygiene:** don't edit harness files while a capture runs. Vite reloads the page and the frame comes out blank.
- **Bugs found while filming:** start a separate thread with the repro (AGENTS.md), and keep the bug out of the shot.

## Files

- `scripts/`
  - Setup: `init.mjs` builds a studio; `export-art.mjs` saves the buddy SVGs.
  - Captures: `snap.mjs` (stills), `seq.mjs` (interactions), `typing.mjs`, `manifests.py`.
  - Video: `render.mjs` turns a page into frames, then an MP4 or stills; `cues.mjs` lists a page's sound cues.
  - Audio:
    - `narration.py`: spec, fit and captions.
    - `gen-audio.mjs`, `transcribe.mjs`, `judge-audio.mjs` and `rank-audio.mjs`: AI Gateway.
    - `mix.py` and `sfx.py`: the mix and the UI sounds.
- `engine/`: the page runtime.
  - `engine.js`: the timeline, the frame-exact seek, text reveals, typing and sound cues.
  - `kit.js`: scenes, text, cards, the phone, and real-screen stills, sequences, taps and auto-fit.
  - `common.css`: Zoonk's tokens and the base styles.
- `realui/`: the harness that renders app components outside Next.
  - The Vite config, which compiles translations with next-intl's own loaders, as Main's build does.
  - Views for the player (`player.tsx`), the learn screens (`learn/`) and the exam, language and progress screens (`goals/`).
  - `art.tsx`: the brand art.
  - `story.ts`: the sample learner per locale.
- `example/zoonk-2/`: the 2.0 launch film. Copy it, then change what the new video needs.
  - Pages: `long`, `short` and `thumb`, as `.html` and `.js`.
  - `copy.js`: the supers in both languages.
  - `stills.json`: the screens to capture.
  - `narration.py`: lines, voice and sample words.
  - `music.json`: the prompts for the two beds.
