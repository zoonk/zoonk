// The Playwright provider's types give `cdp()` its session's `send`.
/// <reference types="@vitest/browser-playwright" />
import { expect } from "vitest";
import { type Locator, cdp } from "vitest/browser";

/**
 * A finger on the touch screen (`*.touch.browser.test.tsx`), sent through the browser's own touch
 * input: the page scrolls and cancels pointers the way a phone does, which synthetic touch events
 * skip.
 */

/** Longer than a press takes to lift an item: shorter touches scroll the page instead. */
const HOLD_MS = 400;

const MOVE_STEPS = 12;

/**
 * How long a swipe's finger is on the glass, stamped on its touches: a quick flick, however long
 * the browser takes to deliver each one under load.
 */
const FLICK_MS = 200;

type Point = { x: number; y: number };

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
 * One touch event. `at` (ms since the epoch) is when the finger did it; without it, it's when the
 * browser gets the event.
 */
async function touch(
  type: "touchEnd" | "touchMove" | "touchStart",
  touchPoints: Point[],
  at?: number,
) {
  await cdp().send("Input.dispatchTouchEvent", {
    touchPoints,
    type,
    ...(at === undefined ? {} : { timestamp: at / 1000 }),
  });
}

/**
 * Moves the finger in even steps from `start` to `end`, as a drag or a swipe does, each step at
 * `at(step)` when given.
 */
async function moveFinger({
  at,
  end,
  start,
}: {
  at?: (step: number) => number;
  end: Point;
  start: Point;
}) {
  for (let step = 1; step <= MOVE_STEPS; step += 1) {
    const point = {
      x: start.x + ((end.x - start.x) * step) / MOVE_STEPS,
      y: start.y + ((end.y - start.y) * step) / MOVE_STEPS,
    };

    // oxlint-disable-next-line no-await-in-loop -- A finger moves through each point in turn.
    await touch("touchMove", [point], at?.(step));
  }
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
  await touch("touchStart", [start]);

  // The hold is the gesture itself, not a wait for the page: a finger rests before it drags.
  await new Promise((resolve) => {
    setTimeout(resolve, HOLD_MS);
  });

  await moveFinger({ end: centerOf(to), start });
  await touch("touchEnd", []);
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
  const at = (step: number) => startedAt + (FLICK_MS * step) / (MOVE_STEPS + 1);

  await touch("touchStart", [start], startedAt);
  await moveFinger({ at, end: { x: start.x + x, y: start.y + y }, start });

  if (liftReadAfterMs > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, liftReadAfterMs);
    });
  }

  await touch("touchEnd", [], startedAt + FLICK_MS);
}

/** A quick finger swipe up from an element, with no hold first. */
export function swipeUpFrom(from: Locator, distance: number) {
  return swipeFrom(from, { y: -distance });
}

export async function tap(locator: Locator) {
  await expect.element(locator).toBeVisible();
  const point = centerOf(locator);

  await touch("touchStart", [point]);
  await touch("touchEnd", []);
}
