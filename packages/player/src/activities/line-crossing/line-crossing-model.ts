import { crossing, shiftLine } from "@zoonk/core/library/activities/line-crossing";

/** A straight line on the chart: y = intercept + slope × x. */
export type Line = { intercept: number; slope: number };

export type Point = { x: number; y: number };

/** Which way lines move: sideways (left and right) or up and down, as the real change did. */
export type ShiftAxis = "horizontal" | "vertical";

/** How far each line is moved, by its id: right or up is positive. */
export type LineOffsets = Readonly<Record<string, number>>;

type Direction = "down" | "left" | "right" | "up";

const HEADROOM = 1.25;
const MIN_SPAN = 1;
/** Drag steps per real shift, so the real one lands exactly on a step. */
const STEPS_PER_SHIFT = 4;
/** Float noise allowed when comparing crossings, relative to their size. */
const RELATIVE_SLACK = 1e-9;

export function shiftAxis(direction: Direction): ShiftAxis {
  return direction === "left" || direction === "right" ? "horizontal" : "vertical";
}

function directionOf(offset: number, axis: ShiftAxis): Direction {
  if (axis === "horizontal") {
    return offset > 0 ? "right" : "left";
  }

  return offset > 0 ? "up" : "down";
}

/** A line moved by a signed offset along the axis: the same move core's check makes. */
export function movedLine(line: Line, offset: number, axis: ShiftAxis): Line {
  return shiftLine(line, { amount: Math.abs(offset), direction: directionOf(offset, axis) });
}

/** Where two lines cross, or the origin when they never do (validation keeps them crossing). */
export function crossingPoint(first: Line, second: Line): Point {
  return crossing(first, second) ?? { x: 0, y: 0 };
}

function yAt(line: Line, x: number): number {
  return line.intercept + line.slope * x;
}

/** Only one line moves at a time, so the answer names one line and one direction. */
export function moveLine(id: string, offset: number): LineOffsets {
  return { [id]: offset };
}

/** The learner's move as the template's answer, or null while nothing has moved. */
export function lineShiftAnswer(offsets: LineOffsets, axis: ShiftAxis) {
  const moved = Object.entries(offsets).find(([, offset]) => offset !== 0);

  if (!moved) {
    return null;
  }

  const [curve, offset] = moved;
  return { curve, direction: directionOf(offset, axis), kind: "curveShift" } as const;
}

/** How far a line can be dragged: twice the real shift each way, in quarter steps of it. */
export function shiftRange(amount: number) {
  return { max: amount * 2, min: -amount * 2, step: amount / STEPS_PER_SHIFT };
}

/**
 * Axes that fit the crossing for every line in every position the learner can drag it to, with
 * room above and to the right, starting at zero.
 */
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

/**
 * The stretch of a line inside the chart, from where it enters to where it leaves the box from
 * zero to the domain on both axes. A flat line runs the whole width.
 */
export function visibleSegment(line: Line, domain: Point): { from: Point; to: Point } {
  if (line.slope === 0) {
    return { from: { x: 0, y: line.intercept }, to: { x: domain.x, y: line.intercept } };
  }

  const [atBottom, atTop] = [
    (0 - line.intercept) / line.slope,
    (domain.y - line.intercept) / line.slope,
  ];

  const from = Math.max(0, Math.min(atBottom, atTop));
  const to = Math.min(domain.x, Math.max(atBottom, atTop));
  const [start, end] = from <= to ? [from, to] : [0, 0];

  return { from: { x: start, y: yAt(line, start) }, to: { x: end, y: yAt(line, end) } };
}

/** A point along a line's visible stretch, from its left end (0) to its right end (1). */
export function pointAlong(line: Line, domain: Point, share: number): Point {
  const { from, to } = visibleSegment(line, domain);
  const x = from.x + (to.x - from.x) * share;
  return { x, y: yAt(line, x) };
}

/** Which way a value moved, for words like "the price goes up". */
export function changeDirection(before: number, after: number): "down" | "same" | "up" {
  const slack = Math.max(Math.abs(before), 1) * RELATIVE_SLACK;

  if (Math.abs(after - before) <= slack) {
    return "same";
  }

  return after > before ? "up" : "down";
}
