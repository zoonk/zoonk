import { expect } from "vitest";
import { type Locator, commands } from "vitest/browser";

const HOLD_MS = 400;

const DRAG_MOVES = 12;

const SWIPE_MOVES = 4;

const FLICK_MS = 200;

type Point = { x: number; y: number };

type TouchStep = {
  at?: number;
  touchPoints: Point[];
  type: "touchEnd" | "touchMove" | "touchStart";
  waitMs?: number;
};

declare module "vitest/browser" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Only an interface merges.
  interface BrowserCommands {
    /** Uses driver input because synthetic events skip scrolling and pointer cancellation. */
    touch: (steps: TouchStep[]) => Promise<void>;
  }
}

function centerOf(locator: Locator): Point {
  const box = locator.element().getBoundingClientRect();
  const frame = window.frameElement?.getBoundingClientRect();

  return {
    x: (frame?.left ?? 0) + box.left + box.width / 2,
    y: (frame?.top ?? 0) + box.top + box.height / 2,
  };
}

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

export async function holdAndDrag({ from, to }: { from: Locator; to: Locator }) {
  await expect.element(to).toBeVisible();
  to.element().scrollIntoView({ block: "center" });
  await expect.element(from).toBeInViewport();

  const start = centerOf(from);
  const [firstMove, ...moves] = moveFinger({ end: centerOf(to), moves: DRAG_MOVES, start });

  await commands.touch([
    { touchPoints: [start], type: "touchStart" },
    ...(firstMove ? [{ ...firstMove, waitMs: HOLD_MS }] : []),
    ...moves,
    { touchPoints: [], type: "touchEnd" },
  ]);
}

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
