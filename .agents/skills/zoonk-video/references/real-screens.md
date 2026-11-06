# Real screens

Films show the app's own components, rendered with sample learner data in either language. Don't redraw the UI in HTML: a redrawn screen drifts from the product and needs its own translation.

## The harness

`npm run harness` (in the studio) serves `realui/` with Vite on `http://localhost:5199`.

- **One view per query:** `?view=<name>&lang=<en|pt>`, plus each view's own parameters (`state`, `done`, `scroll`, `at`…). With no `view`, the page lists every view.
- **Repo files:** `@repo/…` imports the repo's files; init links the repo's React, next-intl, Vite and Playwright into the studio, so the harness runs the app's exact versions.
- **Fixed date:** the story's `TODAY` (`realui/story.ts`) is the only date. `main.tsx` gives it to `NextIntlClientProvider` as `now`, with the locale (`en-US` or `pt-BR`) and the São Paulo time zone, and the capture scripts pin the browser clock to it (`scripts/story-clock.mjs`). Days left, review dates and timers read the same on any capture day.
- **Translations:** the Vite config runs next-intl's own extraction and catalog loaders, the ones Main's build uses, and `main.tsx` merges the player, learn and Main catalogs as Main does. Screens show the app's exact wording in each language, namespaces included, and pick up catalog changes on reload.
- **Shims:** `next/image` and `web-haptics` use the player's browser-test shims.
- **Errors stay local:** a module that stops compiling against the app only loses its own views (`main.tsx` loads each one separately). The page's console shows the error.

## Building a view

- **Player activities** (`realui/player.tsx`):
  - Build them with `buildLesson`, `activityStep` and `contentStep` from `packages/player/src/preview`.
  - Use the fixtures in `packages/testing/src/fixtures/activity-contents`, rewritten per locale for the story.
- **Learn screens** (`realui/learn/`, `realui/goals/`):
  - Build them from their components, with `LearnProvider`, no-op adapters (`learn/common.tsx`, `goals/shell.tsx`) and hand-built view models.
  - Read the component's props and the view-model types in `packages/core` and `packages/learn` before filling them.
  - Take numbers the product computes, such as rewards, unlock targets and buddy stages, from the same core helpers the app uses (`BRAIN_POWER_BONUS`, `getGlassesProgress`, `buddyGrowth` in `goals/buddy-energy.tsx`). A typed number drifts from the rules, and the film then advertises the wrong reward.
- **Main's server components:** `goals/buddy-gen.py` copies them into client copies (`buddy-main-*.tsx`, generated, never edited). `main-locale.tsx` and `main-navigation.tsx` stand in for Main's `@/i18n` modules.
- **Data per locale:** keep the learner's story in `realui/story.ts` (goal, names, dates, minutes), with one entry per language. Views read it; they never hard-code copy.
- **Network calls:** fake them in the view.
  - The tutor patches `fetch` for its API origin and streams a scripted answer.
  - Ids sent to an API must be UUIDs, or the zod schemas reject them before your fake answers.
- **Brand art:** `realui/art.tsx` renders every buddy and Trickster pose, and `scripts/export-art.mjs` saves them as SVGs for the scenes (`K.zu("zu-baby-cheer", 180)`).

## Capturing

- **Stills:** `node scripts/snap.mjs <film>/stills.json [name…]` writes `assets/real/<lang>/<name>.png`.
  - The viewport is 390×794 at 3×, with reduced motion and the light theme, after fonts load plus a settle wait (`SETTLE`, 1000 ms).
  - `stills.json` maps each name to its query, or to `{ "query", "langs" }` when only one language needs it.
- **Sequences:** `node scripts/seq.mjs <scenario> <lang>` drives a view through an interaction (taps, drags, typing, streamed answers). It writes numbered frames and a `manifest.json` (frame, label, hold).
  - Add a scenario to `seq.mjs` for each new interaction.
  - `K.seq` plays the frames between two times, weighted by `hold`.
- **Typing:** `node scripts/typing.mjs <lang>` types the story's goal into the real goal box.
- **Manifests:** run `python3 scripts/manifests.py .` after captures, so the pages see every sequence.
- **Hygiene:** don't edit harness files while a capture runs; Vite reloads the page and the frame comes out blank.
- **Check:**
  - Look at every PNG in both languages, for clipped text, wrong numbers, English left in a pt screen, and empty states.
  - Check the copy against the catalog, and the numbers against `packages/core`.

## Placing screens in a scene

- **Phone:** `K.phone(layer, { x, y, scale })` draws the device frame. `K.still` and `K.seq` fill its screen below the status bar.
- **Changing screens:** `K.track([{ at, el, trans }])` swaps screens in one phone, with `fade`, `push`, `up` or `cut`.
- **Taps and rings:** `K.tapAt(screen, x, y, t)` and `K.ring(screen, x, y, w, h, t, t1)` take CSS px of the 390-wide screen, measured from the app's top. Read the positions off the 3× PNG divided by 3.
- **Zooming:** move the phone itself to frame a detail. `fy(screenY, scale)` in `example/zoonk-2/long.js` centers a screen row.
