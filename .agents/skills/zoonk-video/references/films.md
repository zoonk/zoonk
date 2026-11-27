# Films

A film animates captured screens in HTML with GSAP, then captures every frame from a paused timeline, so nothing depends on how fast the machine is. Narration, music and the app's own sounds are mixed in.

## Workflow

1. **Brief.** Settle the formats, length and channels with [formats](formats.md).
   - Each language's folder (`en-US/`, `pt-BR/`) holds the video files, the YouTube thumbnail, `post-copy.md` and the `.srt` captions.
2. **Story from the code.** Follow [story](story.md).
   - Use the blog for inspiration, never as the source.
   - Check every claim, number and label against `packages/core`, the components and the `.po` catalogs.
   - Take goals per locale from the landing page's example sets.
   - Write every line for someone who has never opened Zoonk: their problem and how Zoonk solves it, in everyday words, with only claims that last ([first-time viewers](story.md#write-for-someone-who-has-never-opened-zoonk)).
   - Write the plan as a scene table with the text for both languages side by side, and get it approved before building.
3. **Studio.** [Set it up](../SKILL.md#set-up-the-studio), with the harness running.
4. **Real screens.** Follow [real screens](real-screens.md).
   - Build each view from the real component with the story's data per locale.
   - Capture the film's stills (`snap.mjs <film>/stills.json`), interaction sequences (`seq.mjs`) and the typed goal (`typing.mjs`) at 3×, then run `manifests.py`.
   - Look at every PNG in both languages.
   - Delegate groups of screens to helpers when there are many. Each helper owns its own views file.
5. **Scenes.** Write the film in `<work-dir>/films/<film>/`, with the example as the template.
   - Every line of copy goes in `copy.js`, per language.
   - Timing uses the bar grid of the soundtrack. Composition and pace follow [story](story.md#composition).
   - Render storyboard stills (`render.mjs --stills all --every 2`) and review them as contact sheets before any full render.
6. **Sound.** Follow [audio](audio.md).
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
8. **Deliver** as [the entry](../SKILL.md#rules-for-every-kind) says, and report what you verified and what you could not: you can't listen, so the judge stands in.

## Rules that save a redo

- **One focal point:** in 16:9, never put text beside the phone. With narration, product scenes have no headlines: the phone stays framed on the part the voice describes. Without narration, each headline shows alone, then the phone alone. See [composition](story.md#composition).
- **Locales:**
  - Keep every line of copy in `copy.js` and every learner value in `realui/story.ts`, per locale; scenes and views only read keys.
  - Headlines break only at `<br>` and shrink to fit (`K.fit`), so Portuguese never wraps by surprise.
- **Pace:**
  - Hold each line for about 0.28 s per word plus 0.6 s.
  - No empty frames at cuts.
  - Keep one phone on screen while its screens change, instead of a new phone rising for every beat.
- **Audio:** hold one level. Only lower the music under the voice, never by section.
- **Vertical:**
  - Keep text and the CTA inside x 120–960, y 270–1250.
  - Brand on screen from frame 0.
  - The last frame matches the first, so the video loops.
