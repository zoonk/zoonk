import { crossing, shiftLine } from "@zoonk/core/library/activities/line-crossing";
import { type SnapRange, clamp, snapToStep } from "../_utils/snap-value";

export type Line = { intercept: number; slope: number };

export type Point = { x: number; y: number };

export type ShiftAxis = "horizontal" | "vertical";

export type LineOffsets = Readonly<Record<string, number>>;

export type LineSlide = { at: (offset: number) => Point; offsets: number[]; range: SnapRange };

type Direction = "down" | "left" | "right" | "up";

const HEADROOM = 1.25;
const MIN_SPAN = 1;
const STEPS_PER_SHIFT = 4;
const RELATIVE_SLACK = 1e-9;
const HANDLE_SHARE = 0.82;
const HANDLE_SHARE_STEPS = 100;
const ORIGIN: Point = { x: 0, y: 0 };

// Shares of the chart that fit a whole handle, and its gap from a crossing dot, on the smallest
// plot (192px), so a slide never depends on the window's size.
const HANDLE_MARGIN = 0.08;
const CROSSING_GAP = 0.135;

const HANDLE_SHARES = Array.from(
  { length: HANDLE_SHARE_STEPS + 1 },
  (_, step) => step / HANDLE_SHARE_STEPS,
).toSorted((first, second) => Math.abs(first - HANDLE_SHARE) - Math.abs(second - HANDLE_SHARE));

export function shiftAxis(direction: Direction): ShiftAxis {
  return direction === "left" || direction === "right" ? "horizontal" : "vertical";
}

function directionOf(offset: number, axis: ShiftAxis): Direction {
  if (axis === "horizontal") {
    return offset > 0 ? "right" : "left";
  }

  return offset > 0 ? "up" : "down";
}

export function movedLine(line: Line, offset: number, axis: ShiftAxis): Line {
  return shiftLine(line, { amount: Math.abs(offset), direction: directionOf(offset, axis) });
}

export function crossingPoint(first: Line, second: Line): Point {
  return crossing(first, second) ?? { x: 0, y: 0 };
}

function yAt(line: Line, x: number): number {
  return line.intercept + line.slope * x;
}

export function moveLine(id: string, offset: number): LineOffsets {
  return { [id]: offset };
}

export function lineShiftAnswer(offsets: LineOffsets, axis: ShiftAxis) {
  const moved = Object.entries(offsets).find(([, offset]) => offset !== 0);

  if (!moved) {
    return null;
  }

  const [curve, offset] = moved;
  return { curve, direction: directionOf(offset, axis), kind: "curveShift" } as const;
}

function shiftRange(amount: number): SnapRange {
  return { max: amount * 2, min: -amount * 2, step: amount / STEPS_PER_SHIFT };
}

export function chartDomain({
  amount,
  axis,
  lines,
}: {
  amount: number;
  axis: ShiftAxis;
  lines: readonly [Line, Line];
}): Point {
  const { max } = shiftRange(amount);
  const offsets = [-max, 0, max];
  const [first, second] = lines;

  const points = offsets.flatMap((offset) => [
    crossingPoint(movedLine(first, offset, axis), second),
    crossingPoint(first, movedLine(second, offset, axis)),
  ]);

  const x = Math.max(...points.map((point) => point.x), MIN_SPAN);

  const y = Math.max(
    ...points.map((point) => point.y),
    ...lines.map((line) => line.intercept),
    MIN_SPAN,
  );

  return { x: x * HEADROOM, y: y * HEADROOM };
}

function spanInside(line: Line, low: Point, high: Point): { from: number; to: number } | null {
  if (line.slope === 0) {
    return line.intercept >= low.y && line.intercept <= high.y ? { from: low.x, to: high.x } : null;
  }

  const [atLow, atHigh] = [
    (low.y - line.intercept) / line.slope,
    (high.y - line.intercept) / line.slope,
  ];

  const from = Math.max(low.x, Math.min(atLow, atHigh));
  const to = Math.min(high.x, Math.max(atLow, atHigh));
  return from <= to ? { from, to } : null;
}

export function visibleSegment(line: Line, domain: Point): { from: Point; to: Point } {
  const { from, to } = spanInside(line, ORIGIN, domain) ?? { from: 0, to: 0 };
  return { from: { x: from, y: yAt(line, from) }, to: { x: to, y: yAt(line, to) } };
}

export function changeDirection(before: number, after: number): "down" | "same" | "up" {
  const slack = Math.max(Math.abs(before), 1) * RELATIVE_SLACK;

  if (Math.abs(after - before) <= slack) {
    return "same";
  }

  return after > before ? "up" : "down";
}

/**
 * How a line's handle slides: twice the real shift each way, as far as the line still passes
 * through the chart inset by a handle's margin. At each shift the handle rides its moved line,
 * at the point nearest its resting spot inside that inset. It rests 82% along the line, or at
 * the nearest point to that clear of the resting crossing, kept inside the inset.
 */
export function lineSlide({
  amount,
  axis,
  crossing: restingCrossing,
  domain,
  line,
}: {
  amount: number;
  axis: ShiftAxis;
  crossing: Point;
  domain: Point;
  line: Line;
}): LineSlide {
  const low = { x: domain.x * HANDLE_MARGIN, y: domain.y * HANDLE_MARGIN };
  const high = { x: domain.x - low.x, y: domain.y - low.y };
  const full = shiftRange(amount);
  const count = Math.round((full.max - full.min) / full.step) + 1;

  const offsets = Array.from({ length: count }, (_, index) =>
    snapToStep(full.min + index * full.step, full),
  ).filter((offset) => spanInside(movedLine(line, offset, axis), low, high));

  const visible = spanInside(line, ORIGIN, domain) ?? { from: 0, to: 0 };
  const resting = spanInside(line, low, high) ?? visible;

  const along = (share: number) =>
    clamp(visible.from + (visible.to - visible.from) * share, resting.from, resting.to);

  const isClear = (x: number) =>
    Math.hypot((x - restingCrossing.x) / domain.x, (yAt(line, x) - restingCrossing.y) / domain.y) >=
    CROSSING_GAP;

  const homeX = along(HANDLE_SHARES.find((share) => isClear(along(share))) ?? HANDLE_SHARE);

  function at(offset: number): Point {
    const moved = movedLine(line, offset, axis);
    const preferred = axis === "horizontal" ? homeX + offset : homeX;
    const span = spanInside(moved, low, high);
    const x = span ? clamp(preferred, span.from, span.to) : preferred;
    return { x, y: yAt(moved, x) };
  }

  return {
    at,
    offsets,
    range: { max: Math.max(...offsets), min: Math.min(...offsets), step: full.step },
  };
}
