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

async function touch(type: "touchEnd" | "touchMove" | "touchStart", touchPoints: Point[]) {
  await cdp().send("Input.dispatchTouchEvent", { touchPoints, type });
}

/** Moves the finger in even steps from `start` to `end`, as a drag or a swipe does. */
async function moveFinger({ end, start }: { end: Point; start: Point }) {
  for (let step = 1; step <= MOVE_STEPS; step += 1) {
    const point = {
      x: start.x + ((end.x - start.x) * step) / MOVE_STEPS,
      y: start.y + ((end.y - start.y) * step) / MOVE_STEPS,
    };

    // oxlint-disable-next-line no-await-in-loop -- A finger moves through each point in turn.
    await touch("touchMove", [point]);
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

/** A quick finger swipe up from an element, with no hold first. */
export async function swipeUpFrom(from: Locator, distance: number) {
  await expect.element(from).toBeVisible();
  const start = centerOf(from);

  await touch("touchStart", [start]);
  await moveFinger({ end: { x: start.x, y: start.y - distance }, start });
  await touch("touchEnd", []);
}

export async function tap(locator: Locator) {
  await expect.element(locator).toBeVisible();
  const point = centerOf(locator);

  await touch("touchStart", [point]);
  await touch("touchEnd", []);
}
