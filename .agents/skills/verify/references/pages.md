# Measuring pages

`pnpm verify:pages` (`scripts/verify/`) loads each path fresh, waits until the page stops changing, and measures it on six screens: `phone` (390), `tablet` (820), `tablet-landscape` (1180), `laptop` (1440), `desktop` (1920) and `wide` (2560), the first three with touch. Each screen is loaded in the first color scheme and then switched to the others in place, since dark mode is the device's `prefers-color-scheme` in CSS alone. It exits with 1 when anything fails.

## Run it

| Where                                             | Command                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`                                        | `pnpm verify:pages --email <persona>@zoonk.test /today /plan`                  |
| Production build (`pnpm start`, after `pnpm dev`) | `pnpm verify:pages --email <persona>@zoonk.test --throttle --nav /today /plan` |
| A page anyone can open                            | Leave out `--email`                                                            |

It measures this checkout's Main at its Portless URL, whichever of the two serves it (`--url` points it elsewhere), and signs in with the newest code the dev mailbox received for `--email`.

- `--throttle` is a mid-range phone on slow 4G (4× CPU, 150 ms, 1.6 Mbps), as Lighthouse's mobile run. Use it on production builds; it's what "instant on slower devices" means.
- `--nav` loads the first path, then taps the visible link to each next path in order, as a learner moves between them (on the phone and the laptop).
- `--viewports phone,laptop` and `--schemes light` narrow a run while you fix something; run every screen once at the end.
- `--out <dir>` picks the output folder; it defaults to `tmp/verify/<time>` in the checkout (ignored by git).
- The v2 seed's personas (such as `v2-stocks@zoonk.test`, in `packages/db/src/prisma/seed/v2/learners/personas`) are shared: only read with them. Walks that change a learner's state use your own `pnpm dev:persona` copy.

Each run writes `report.md` (findings grouped across screens, then a row per load and per navigation) and `report.json` (everything measured, every request included). Per page it saves two contact sheets, `screens.png` (every screen in each scheme) and `paints.png` (every paint of each load, by its time in ms), beside the full-page screenshots and each screen's `-frames` folder. A full-page screenshot draws fixed bars, such as the phone's tabs, where the viewport ended; that's the screenshot, not the page.

## What it judges

A **fail** is fixed, or left only with the reason in your report. A **look at** is opened and either fixed or explained. Speed, skeletons, late changes and prefetching are judged only on a production build: a dev server compiles on demand, streams without prefetching, and shows loading states learners never see. The lines live in `BUDGETS` (`scripts/verify/checks.mts`); changing one is a product decision, so propose it with evidence instead of loosening it to pass.

| Check                         | Line                                                                                        | What it usually means, and the usual fix                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uncaught error, console error | Any (fail); console warnings are looked at                                                  | A real bug, a hydration mismatch (server and client render differently: dates, `Math.random`, browser-only values) or a missing translation.                                                                                    |
| Failed response or request    | 5xx fails; 4xx and network failures are looked at                                           | A broken route, asset or API call. Aborted prefetches, and Vercel's `/_vercel/` scripts outside Vercel, are left out.                                                                                                           |
| POST without a click          | Any Server Action or other POST before a tap (look at)                                      | It names the action from the build's manifest. Reading is allowed but costs a round trip after the page painted; a write or a model call on load breaks the root rule that only a learner's click starts work.                  |
| Client data fetch             | Any `fetch` or XHR that isn't Next.js's own (look at)                                       | Data the server could have rendered with the page: read it in a Server Component through `@zoonk/core` and pass it down, instead of fetching in an effect or a client hook.                                                     |
| Layout shift                  | CLS over 0.1 fails; any shift is looked at                                                  | It names what moved. Reserve the space (fixed sizes, the final layout from the first paint), render the content with the page instead of after hydration, or put late UI where it pushes nothing.                               |
| Skeleton                      | A visible `data-slot="skeleton"` on a production build                                      | A Suspense fallback learners see. Make that content part of the static shell or cached data (`next-cache-components-optimizer`), not a nicer skeleton.                                                                          |
| Late change                   | A paint more than 1 s after the largest one (look at)                                       | Something arrived or changed after the page looked done: client-only UI after hydration, a client fetch, a late image, an animation. Open the frames.                                                                           |
| LCP, FCP                      | Over 2.5 s and 1.8 s throttled (look at over 1.2 s and 1 s)                                 | Large HTML or JS, render-blocking work, or content waiting on data. Compare the KB column and `next-bundle-optimizer`.                                                                                                          |
| Server CPU                    | Over 1 s per load (look at over 250 ms)                                                     | The Next.js process behind the URL, after one warm-up load, including the prefetches the page starts; judged on `pnpm start`. Work done on read that belongs on write, or repeated reads (zoonk-testing's read-shape ratchets). |
| Not prefetched                | A visible link with no prefetch (look at)                                                   | A `<Link prefetch={false}>`, a plain `<a>`, or a route Next.js can't prefetch. A learner tapping it waits for the server.                                                                                                       |
| Navigation                    | Over 1 s to the new URL fails (look at over 200 ms); a skeleton after the tap fails         | The tap waited on the network: the page's instant UI wasn't prefetched (`next-partial-prefetching-optimizer`).                                                                                                                  |
| Horizontal overflow           | The page is wider than the screen                                                           | It names the outermost elements sticking out: a fixed width, a long unbroken word, a row that doesn't wrap.                                                                                                                     |
| Accessibility                 | axe-core serious or critical, or a target under 44 px, on a device asking for more contrast | The same rules the player's browser tests apply (`packages/testing/src/accessibility`).                                                                                                                                         |

## What it can't tell you

- **Whether the change does what it should.** It loads pages; it doesn't use them. Section 3 of the skill does.
- **Responsiveness to input (INP), re-renders and Suspense boundaries.** Drive the interaction, then use `agent-browser` (`vitals`, `react renders start|stop`, `react suspense`), or record a Chrome DevTools performance trace.
- **Screens behind a tap**, such as dialogs, sheets, the lesson player and results. Reach them in the walk and screenshot them there.
- **Taste.** It saves the screenshots; you look at every one with zoonk-design's taste bar.
- **Field data.** These are lab numbers on this machine. Compare before and after on the same setup, and don't compare a loaded machine's run with a quiet one's.
