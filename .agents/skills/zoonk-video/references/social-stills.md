# Social stills

A post image shows one moment of one feature, made from the app's real components on a stage. `example/launch/scenes.ts` holds the launch set (`goal`, `time`, `today`, `goal-angle`); copy it to start a new one.

## The look

1. **The ground is the app's own background**, light or black, with one soft light on it (`stage.light(x, y)`). No card, no frame, no colored ground.
2. **One real component in focus**, at the app's wide layout: the narrowest width that gives its composed layout (660 px makes the goal box one line). Scale it until its key line is at least 40 px tall on the 1600 px image, about 10 px in a feed. It is always whole: never cut through the thing being shown.
3. **One quieter layer behind it**, related to it: what the sentence becomes, what the button leads to, the week around the day. It sits lower in contrast and leaves the frame through a fade (`stage.fade`), so the bleed reads as depth.
4. **One sign of a moment:** a caret after the last letter (`field`), or a finger on what is about to be pressed (`stage.touch`).
5. **Interface and ground in the same theme.** Never a light card on black; the stage renders both schemes from one scene.
6. **No words on top.** The interface's own words carry the image; the post's text does the rest.

**Flat is the default.** The tilted variant (`stage.tilt`, the layer behind out of focus) is the most striking at full size and the least readable in a feed: use it for a hero or a cover, not for every feature.

**Light is the default.** Use black for a launch's lead image and for images that are mostly large type. Black is the more distinctive look; small grey text holds up better on light after a platform compresses it.

**Sizes.** 1600×900 for X and LinkedIn, 1080×1350 for Instagram and LinkedIn. The 4:5 uses the phone layout and reads larger in a feed (about 15 px type at 400 px wide, against 10 px for the 16:9), so it's the one to use where size matters most. Platform specs and their sources are in [zoonk-social-post's platforms](../../zoonk-social-post/references/platforms.md).

## Making one

1. **Pick the learner per language.** `realui/learners/learners.ts` holds sample learners typed against core (Madrid and the SAT in English, Ana's ENEM in Portuguese). Every value comes from the running app: capture the screens from a seeded persona first (`pnpm dev:persona`, see [persona passes](../../zoonk-persona-walkthrough/references/passes.md)), then copy what they show. A new screen needs a view in `realui/learners/index.tsx` built from the component and the view models in `view-models.ts`; run `npm run typecheck` after.
2. **Pick the pieces.** `realui/stage/pieces.ts` names what's worth showing per screen, each found by the app's own `data-slot`. When a piece has no stable hook, add a `data-slot` to the app element in the same change, never a positional selector.
3. **Write the scene,** about 30 lines in `films/<set>/scenes.ts`: load the pieces, place them (`piece.place({ x, y, s, o })`), fade the layer behind, add the sign. Size from what the words need, not from the box: `piece.inkWidth()` is how far the words reach, and a narrower view width lets the app wrap a long line (Portuguese runs about 20% longer) instead of shrinking the whole piece.
4. **Render every size, scheme and language** with the harness running:

```sh
node scripts/stills.mjs --film <set> --scenes goal,time --out <dir>   # <dir>/<lang>/<scene>-<16x9|4x5>-<light|black>.png
```

Narrow a try with `--langs en --formats 16x9 --schemes light`. Each image renders at 2× and is reduced with lanczos to its exact size. `http://localhost:<port>/stage/?film=<set>&scene=<scene>&fmt=4x5&lang=pt` shows one in a browser.

## Checking

- Look at every image at full size and at 400 px wide, in both languages and both schemes. A contact sheet of all of them at 400 px is the feed check.
- Every word inside the frame, every layer behind leaving through its fade, nothing cut at an edge, no English in a Portuguese image.
- Labels, numbers and dates match what the app shows that learner; a date the app writes as "~Jan 11" stays an estimate.
