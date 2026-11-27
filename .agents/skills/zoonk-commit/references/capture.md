# Capturing screens and videos

How to take the pictures a PR shows ([show the change](show-the-change.md)), the same way on both sides.

`pnpm pr:capture` captures Main (`--app api` or `--app admin` another app) the same way on both sides records each picture's bytes, build and screen in `capture.json` beside it, and measures each screen it shoots into the side's `alignment.json`. Run it on `pnpm start` serving this checkout, after you commit: `pnpm dev` adds its own overlay and loading states learners never see, and an after picture from it, from another checkout's server or from uncommitted changes can't pass the [picture gate](picture-gate.md).

```sh
pnpm pr:capture before /today /plan --email <learner>@zoonk.test   # before you edit
pnpm pr:capture after /today /plan --email <learner>@zoonk.test    # after the change
```

Each run shoots every path on a phone and a laptop in light mode (`--viewports`; `--schemes light,dark` when colors change), replaces `tmp/pr-media/<side>/` and, once the gate passes, rewrites `tmp/pr-media/media.md`: a collapsed panel per screen pairing each screenshot with its other side, then a panel per video. For a screen behind taps, or a video (`--video`), write the steps once and pass them to both runs, such as `pnpm pr:capture after --steps tmp/pr-media/steps.mts --video --viewports phone`:

```ts
// tmp/pr-media/steps.mts
export default async function steps({ page, shot }) {
  await page.goto("/today");
  await shot("today");
  await page.getByRole("button", { name: "Start" }).click();
  await shot("first question");
}
```

- `shot(name, options)` waits until the page stops changing, or shoots at once with `settle: false` (a loading state), and takes Playwright's screenshot options (`fullPage`, `mask`). On a phone, a full-page shot ends touch emulation until the next load, so take it after the taps.
- The steps run on each screen and scheme in turn. When they change what the learner has (an answer, a finished lesson), capture one screen and give each side its own learner (`pnpm dev:persona`).
- If you already changed the code, capture the before side on the base the way [measuring pages](../../verify/references/pages.md) measures a `--baseline`.
- A state no persona reaches, such as a question only a model would write, gets added to the seed or to `pnpm dev:persona --state` and captured from there. Never picture a component rendered on its own: it drops the page's frame (the pinned bar, the width, the top), so it shows a screen learners never get.
- Look at every shot and video before you attach it: a path that fails stops the run, but a step that lands on the wrong screen still makes a picture of it.
- Attached files are public, like the repository: show seeded and `dev:persona` learners only, never a real learner's data or a secret.
- For the Apple app, take each screenshot with its [layout capture](../../verify/references/apple-layout-capture.md), which records it as `pr:capture` does. For Android, take them from a JVM render with its [layout capture](../../verify/references/android-renders.md#layout-capture) and adopt them (below); a sheet or dialog shown over its page comes from the emulator, taken by `pnpm pr:media device` (below). Open the app with `agent-device`, then use `agent-device record start <file.mp4> --scope device` and `agent-device record stop`. On a foldable, set the pose before starting each recording. Put them in the same panels.

[Uploading them](../../zoonk-pull-request/references/pictures.md) happens when the PR's body goes up.
