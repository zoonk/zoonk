# Feature demos

A feature demo is a silent clip of one feature in one continuous shot, 15 to 25 seconds, that ends on the mark with zoonk.com. It's made on the same stage as the [social stills](social-stills.md), from the same pieces and learners, so a feature's clip and its images share one source. The launch clip (`clip` in `example/launch/scenes.ts`) goes from a typed goal to its plan to today in 16.5 s.

## Frames

- **16:9** (1920×1080, X and LinkedIn) keeps the app's wide layout.
- **4:5** (1080×1350, Instagram's feed and LinkedIn) and **9:16** (1080×1920, Reels) use the phone layout, filling a column that stays clear of the side dissolve even when the camera leans in, with every word inside the frame's safe band: on 9:16, the [safe box](formats.md#instagram-reels-and-tiktok-916) a Reel's buttons and caption leave. The launch scene keeps both in `FRAMING`.
- **A portrait cut loops:** it opens on the mark it ends on (`stage.open`), so the brand shows from the first frame and the replay is seamless. It starts the shot about a second later.

## The shot

- **One shot, no cuts.** Each change of screen is carried by something both screens share: the goal box lifts and the plan comes out from under it; the plan's "45 min" and Today's "45 min left" are the same number, so Today is placed where its digits land (`digits`) and the number holds still while everything else changes.
- **The camera never stops** (`camera`): it leans in while the sentence is written, travels while rows arrive, and opens out slowly before the end. When it rests, something else moves.
- **Parts arrive one after another** (`arrive`): things of one kind 0.06 to 0.09 s apart, sentences such as a path's phases about 0.24 s apart. An arrival starts before the move before it ends.
- **Three easings, no overshoot** (`EASE`): `out` for what arrives, `inOut` for the camera and carried elements, `swing` or `linear` for drifts over seconds. A demo isn't an earned moment, so nothing springs ([zoonk-motion](../../zoonk-motion/SKILL.md)).
- **What the app does at once stays instant:** focus, a button waking up, focus leaving.
- **Typing happens in the real field** (`field`, `typingTimes`), with the app's own input handling and a caret the stage draws. Derive every beat after the typing from the sentence's length, so the longer language still has a breath before the press.
- **The cause before the result:** the button gives way (the app's press scale) before the plan appears. The plan's wait is skipped, as every reference clip skips its product's wait.
- **Lay out from the finished state:** place a field from its piece loaded with the whole sentence, so the room it grows into is already there; every piece's crop follows its elements as they change.
- **Edges** (`stage.edges()`): whatever the camera carries past the top or bottom dissolves on the way. Once it settles, nothing sits in the dissolve at the sides.
- **The end** (`stage.end`): the ground covers the shot and the mark comes up with zoonk.com, held about 2.5 s.

Write the timeline as a table first (time, what happens, what carries it) and get it approved before building.

## Rendering

With the harness running, render a storyboard and look at it before the full render:

```sh
node scripts/render.mjs --url "http://localhost:<port>/stage/?film=<set>&scene=clip&lang=en" \
  --w 1920 --h 1080 --stills 0.5,2.5,4.5,6,8,10,12,15 --outdir out/board-en
```

Before writing a frame, `render.mjs` checks every one: a frame where a crop slices words, or where a piece sits in the side dissolve once the camera settles, fails the render with its time and the piece.

Then each cut, from the repo root so it takes its turn on a shared machine. Light is the one to post (video compression is harder on dark greys); black is the same timeline with `--scheme dark`. For a portrait cut, add `&fmt=4x5` or `&fmt=9x16` to the URL and render at that size (`--w 1080 --h 1350` or `--w 1080 --h 1920`, with the same `--outw` and `--outh`):

```sh
pnpm dev:queue node <studio>/scripts/render.mjs --url "http://localhost:<port>/stage/?film=<set>&scene=clip&lang=pt" \
  --w 1920 --h 1080 --dpr 2 --outw 1920 --outh 1080 --fps 60 --scheme light --out <dir>/pt/<name>-16x9.mp4
```

## Checking

- **ffprobe:** H.264 High, the cut's size, 60 fps, yuv420p, BT.709, no audio stream.
- **Decode pass:** `ffmpeg -v error -i <file> -f null -` prints nothing.
- **Frames:** a sheet of a frame every 0.25 s, and frames at 15 a second across each change of screen, looked at one by one, in both languages. Nothing sits under rows arriving, no frame is blank, and no element both arrives and leaves on the same node (the later fade wins and the element shows early).
- **At 400 px wide:** the sentence, the readouts and zoonk.com read on a phone.
- **A portrait cut:** its first and last frames match, and its words stay inside the safe band.
