import { crossing, shiftLine } from "@zoonk/core/library/activities/line-crossing";

export type Line = { intercept: number; slope: number };

export type Point = { x: number; y: number };

export type ShiftAxis = "horizontal" | "vertical";

export type LineOffsets = Readonly<Record<string, number>>;

type Direction = "down" | "left" | "right" | "up";

const HEADROOM = 1.25;
const MIN_SPAN = 1;
const STEPS_PER_SHIFT = 4;
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

export function shiftRange(amount: number) {
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

export function pointAlong(line: Line, domain: Point, share: number): Point {
  const { from, to } = visibleSegment(line, domain);
  const x = from.x + (to.x - from.x) * share;
  return { x, y: yAt(line, x) };
}

export function changeDirection(before: number, after: number): "down" | "same" | "up" {
  const slack = Math.max(Math.abs(before), 1) * RELATIVE_SLACK;

  if (Math.abs(after - before) <= slack) {
    return "same";
  }

  return after > before ? "up" : "down";
}
