import { expect } from "vitest";
import { type Locator, commands } from "vitest/browser";

/**
 * A finger on the touch screen (`*.touch.browser.test.tsx`), sent through the browser's own touch
 * input: the page scrolls and cancels pointers the way a phone does, which synthetic touch events
 * skip. Each gesture's touches go to the browser's driver in one call (the `touch` command in
 * vitest.config.mts).
 */

/** Longer than a press takes to lift an item: shorter touches scroll the page instead. */
const HOLD_MS = 400;

/** A drag's moves: enough for what's under the finger to follow it onto its target. */
const DRAG_MOVES = 12;

/**
 * A swipe's moves: the page reads a swipe from where the finger lands and lifts, and the browser
 * starts scrolling or a control starts following it on the first move. The browser hands the page
 * one touch move per frame, so every move adds a frame to each swipe.
 */
const SWIPE_MOVES = 4;

/**
 * How long a swipe's finger is on the glass, stamped on its touches: a quick flick, however long
 * the browser takes to deliver each one under load.
 */
const FLICK_MS = 200;

type Point = { x: number; y: number };

/**
 * One touch event, `waitMs` after the one before when given. `at` (ms since the epoch) is when the
 * finger did it; without it, it's when the browser gets the event.
 */
type TouchStep = {
  at?: number;
  touchPoints: Point[];
  type: "touchEnd" | "touchMove" | "touchStart";
  waitMs?: number;
};

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    touch: (steps: TouchStep[]) => Promise<void>;
  }
}

/** An element's center on the page that holds the test's frame, which touch input addresses. */
function centerOf(locator: Locator): Point {
  const box = locator.element().getBoundingClientRect();
  const frame = window.frameElement?.getBoundingClientRect();

  return {
    x: (frame?.left ?? 0) + box.left + box.width / 2,
    y: (frame?.top ?? 0) + box.top + box.height / 2,
  };
}

/**
 * The finger's `moves` in even steps from `start` to `end`, as a drag or a swipe makes them, each
 * step at `at(step)` when given.
 */
function moveFinger({
  at,
  end,
  moves,
  start,
}: {
  at?: (step: number) => number;
  end: Point;
  moves: number;
  start: Point;
}): TouchStep[] {
  return Array.from({ length: moves }, (_, index) => {
    const step = index + 1;

    const point = {
      x: start.x + ((end.x - start.x) * step) / moves,
      y: start.y + ((end.y - start.y) * step) / moves,
    };

    return { at: at?.(step), touchPoints: [point], type: "touchMove" };
  });
}

/**
 * Presses an item, holds it and drags it onto a target. The target comes to the middle of the
 * screen first, with the item still in view, as a learner sees both before a drag: at the edge,
 * the drag would scroll the lesson under the finger.
 */
export async function holdAndDrag({ from, to }: { from: Locator; to: Locator }) {
  await expect.element(to).toBeVisible();
  to.element().scrollIntoView({ block: "center" });
  await expect.element(from).toBeInViewport();

  const start = centerOf(from);
  const [firstMove, ...moves] = moveFinger({ end: centerOf(to), moves: DRAG_MOVES, start });

  await commands.touch([
    { touchPoints: [start], type: "touchStart" },
    // The hold is the gesture itself, not a wait for the page: a finger rests before it drags.
    ...(firstMove ? [{ ...firstMove, waitMs: HOLD_MS }] : []),
    ...moves,
    { touchPoints: [], type: "touchEnd" },
  ]);
}

/**
 * A quick finger swipe from an element, with no hold first: sideways and up or down by `x` and `y`.
 * Its touches are stamped `FLICK_MS` apart in all, so it's as quick on a loaded machine. With
 * `liftReadAfterMs`, the page gets the lift that much later, as a busy phone reads it.
 */
export async function swipeFrom(
  from: Locator,
  { liftReadAfterMs = 0, x = 0, y = 0 }: { liftReadAfterMs?: number; x?: number; y?: number },
) {
  await expect.element(from).toBeVisible();
  const start = centerOf(from);
  const startedAt = Date.now();
  const at = (step: number) => startedAt + (FLICK_MS * step) / (SWIPE_MOVES + 1);

  await commands.touch([
    { at: startedAt, touchPoints: [start], type: "touchStart" },
    ...moveFinger({ at, end: { x: start.x + x, y: start.y + y }, moves: SWIPE_MOVES, start }),
    { at: startedAt + FLICK_MS, touchPoints: [], type: "touchEnd", waitMs: liftReadAfterMs },
  ]);
}

/** A quick finger swipe up from an element, with no hold first. */
export function swipeUpFrom(from: Locator, distance: number) {
  return swipeFrom(from, { y: -distance });
}

export async function tap(locator: Locator) {
  await expect.element(locator).toBeVisible();
  const point = centerOf(locator);

  await commands.touch([
    { touchPoints: [point], type: "touchStart" },
    { touchPoints: [], type: "touchEnd" },
  ]);
}
