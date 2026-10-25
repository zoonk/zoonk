import { type BrowserContext, type Locator, type Page, expect } from "@playwright/test";

/**
 * Helpers for pages whose code loads on demand (a chart, the lesson player): what a learner saw on
 * each frame, and code that arrives as slowly as over a phone's network.
 */

/** What a frame showed of one selector: nothing visible, server HTML, or what React has hydrated. */
type FrameState = "hydrated" | "none" | "shown";

export type PaintedFrame = { at: number; seen: Record<string, FrameState> };

type FrameLog = { frames: PaintedFrame[]; mark: number };

declare global {
  /** The frames `watchPaintedFrames` noted in the page. */
  var paintedFrames: FrameLog | undefined;
}

/**
 * Notes, on every frame from the page's first paint, which of `selectors` a learner could see,
 * so a test checks each paint, not just where the page ends. A page left behind stays in the DOM,
 * hidden, for going back to it: only visible matches count. React marks every node it renders or
 * hydrates (its `__react` keys), which tells server HTML from a hydrated page.
 */
export async function watchPaintedFrames(
  target: BrowserContext | Page,
  selectors: Record<string, string>,
) {
  await target.addInitScript((watched: Record<string, string>) => {
    const log: FrameLog = { frames: [], mark: 0 };
    globalThis.paintedFrames = log;

    // oxlint-disable-next-line unicorn/consistent-function-scoping -- The init script runs in the page on its own: what it uses lives inside it.
    function stateOf(selector: string): FrameState {
      const shown = [...document.querySelectorAll(selector)].find((node) => node.checkVisibility());

      if (!shown) {
        return "none";
      }

      return Object.keys(shown).some((key) => key.startsWith("__react")) ? "hydrated" : "shown";
    }

    function note() {
      log.frames.push({
        at: performance.now(),
        seen: Object.fromEntries(
          Object.entries(watched).map(([name, selector]) => [name, stateOf(selector)]),
        ),
      });

      requestAnimationFrame(note);
    }

    requestAnimationFrame(note);
  }, selectors);
}

/** Starts a new stretch: `paintedFramesSince` returns only frames painted after this. */
export async function markPaintedFrames(page: Page) {
  await page.evaluate(() => {
    if (globalThis.paintedFrames) {
      globalThis.paintedFrames.mark = globalThis.paintedFrames.frames.length;
    }
  });
}

/** The frames painted since the last mark (or since the page opened). */
export function paintedFramesSince(page: Page): Promise<PaintedFrame[]> {
  return page.evaluate(() => {
    const log = globalThis.paintedFrames;
    return log ? log.frames.slice(log.mark) : [];
  });
}

/** How late code arrives over a slow connection, well past what "at once" allows. */
const SLOW_CODE_MS = 3000;

/** "At once" for a page opened from a link, well under how late slowed code arrives. */
export const AT_ONCE_MS = 1000;

/** From now on, every script the page asks for arrives `SLOW_CODE_MS` late. */
export async function slowCodeFromNow(page: Page) {
  await page.route("**/_next/static/chunks/**/*.js", async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, SLOW_CODE_MS);
    });

    await route.continue();
  });
}

/** The page's scripts. */
const CODE_URL = /\/_next\/static\/chunks\/[^?]+\.js(?:\?.*)?$/u;

/**
 * A slow device: from now on, the script holding `marker` (code only that part of the page needs)
 * waits to arrive until `release()` (or the page closes), while the page's other code and its
 * styles arrive as usual. `held()` says whether the page has asked for it yet.
 */
export async function holdCodeWith({ marker, page }: { marker: string; page: Page }) {
  const code = Promise.withResolvers<null>();
  let held = false;
  const release = () => code.resolve(null);
  page.once("close", release);

  await page.route(CODE_URL, async (route) => {
    const response = await route.fetch();
    const body = await response.text();

    if (body.includes(marker)) {
      held = true;
      await code.promise;
    }

    await route.fulfill({ body, response });
  });

  return { held: () => held, release };
}

/**
 * Notes the scripts holding `marker` the page loads from now on: `requestedAt()` says when it first
 * asked for one, on the page's clock (`performance.now()`, as `PaintedFrame.at`), Infinity if never.
 */
export function followCodeWith({ marker, page }: { marker: string; page: Page }) {
  const urls = new Set<string>();
  const reads: Promise<void>[] = [];

  page.on("response", (response) => {
    if (CODE_URL.test(response.url())) {
      reads.push(
        response
          .text()
          // A script the page dropped (it closed) has nothing to look in.
          .catch(() => "")
          .then((body) => {
            if (body.includes(marker)) {
              urls.add(response.url());
            }
          }),
      );
    }
  });

  return {
    requestedAt: async () => {
      await Promise.all(reads);

      return page.evaluate(
        (names) =>
          Math.min(
            ...names.flatMap((name) =>
              performance.getEntriesByName(name).map((entry) => entry.startTime),
            ),
          ),
        [...urls],
      );
    },
  };
}

/**
 * When every script the page had asked for by `at` had arrived, on the page's clock (as
 * `PaintedFrame.at`): from then on, nothing the page draws waits on code still coming.
 */
export function codeArrivedBy({ at, page }: { at: number; page: Page }): Promise<number> {
  return page.evaluate(
    ({ before, pattern }) => {
      const code = new RegExp(pattern, "u");

      const arrivals = performance
        .getEntriesByType("resource")
        .flatMap((entry) =>
          entry instanceof PerformanceResourceTiming &&
          code.test(entry.name) &&
          entry.startTime < before
            ? [entry.responseEnd]
            : [],
        );

      return Math.max(0, ...arrivals);
    },
    { before: at, pattern: CODE_URL.source },
  );
}

/** Whether React has hydrated what `locator` finds (it marks every node it takes over). */
export function isHydrated(locator: Locator): Promise<boolean> {
  return locator.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__react")));
}

/** Waits until React has hydrated what `locator` finds, so a tap on it is the page's to handle. */
export async function expectHydrated(locator: Locator) {
  await expect.poll(() => isHydrated(locator)).toBe(true);
}

/** How long without a request in flight before the page's loads count as settled. */
const QUIET_MS = 500;

/** Slow loads one after another that settling still waits for. */
const SLOW_LOADS_IN_A_ROW = 4;

/**
 * Follows the page's requests from now on; `settled()` waits until none has been in flight for a
 * moment. (Playwright's "networkidle" only describes the first load.) Start it before what loads,
 * so a request already under way when the test waits still counts.
 */
export function followRequests(page: Page) {
  const inFlight = new Set<unknown>();
  let changedAt = Date.now();

  const started = (request: unknown) => {
    inFlight.add(request);
    changedAt = Date.now();
  };

  const ended = (request: unknown) => {
    inFlight.delete(request);
    changedAt = Date.now();
  };

  page.on("request", started);
  page.on("requestfinished", ended);
  page.on("requestfailed", ended);

  return {
    settled: () =>
      expect
        .poll(() => inFlight.size === 0 && Date.now() - changedAt >= QUIET_MS, {
          timeout: SLOW_LOADS_IN_A_ROW * SLOW_CODE_MS,
        })
        .toBe(true),
  };
}

/** Waits until the page has run what it defers to idle time, and the loads it started. */
export async function settleIdleWork(page: Page, requests: ReturnType<typeof followRequests>) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestIdleCallback(resolve);
      }),
  );

  await requests.settled();
}
