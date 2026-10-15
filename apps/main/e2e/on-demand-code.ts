import { type BrowserContext, type Page, expect } from "@playwright/test";

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

/** From now on, every script the page asks for arrives `SLOW_CODE_MS` late. */
export async function slowCodeFromNow(page: Page) {
  await page.route("**/_next/static/chunks/**/*.js", async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, SLOW_CODE_MS);
    });

    await route.continue();
  });
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
