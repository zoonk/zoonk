import { crossing, shiftLine } from "@zoonk/core/library/activities/line-crossing";
import { type SnapRange, clamp, snapToStep } from "../_utils/snap-value";

export type Line = { intercept: number; slope: number };

export type Point = { x: number; y: number };

export type ShiftAxis = "horizontal" | "vertical";

export type LineOffsets = Readonly<Record<string, number>>;

export type LineSlide = { at: (offset: number) => Point; offsets: number[]; range: SnapRange };

export type ChartDomain = { max: Point; min: Point };

type NamedLine = Line & { id: string };

type Direction = "down" | "left" | "right" | "up";

const HEADROOM = 1.25;
const STEPS_PER_SHIFT = 4;
const RELATIVE_SLACK = 1e-9;
const HANDLE_SHARE = 0.82;
const HANDLE_SHARE_STEPS = 20;

// Shares of the chart that fit a whole handle, and its gap from a crossing dot, on the smallest
// plot (192px), so a slide never depends on the window's size.
const HANDLE_MARGIN = 0.08;
const CROSSING_GAP = 0.135;
const KEPT_MARGIN = HANDLE_MARGIN * 2;
const HANDLES_APART = 0.2;

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

function lowerBound(lowest: number, upper: number): number {
  return Math.min(0, (lowest - KEPT_MARGIN * upper) / (1 - KEPT_MARGIN));
}

/**
 * The chart's span: from the origin to past every crossing the learner can reach, reaching below
 * zero only as far as it takes for the resting and the right crossings to sit inside the handles'
 * margin, with room to spare.
 */
function chartDomain({
  amount,
  axis,
  lines,
  real,
}: {
  amount: number;
  axis: ShiftAxis;
  lines: readonly [NamedLine, NamedLine];
  real: LineOffsets;
}): ChartDomain {
  const { max } = shiftRange(amount);
  const [first, second] = lines;

  const reachable = [-max, 0, max].flatMap((offset) => [
    crossingPoint(movedLine(first, offset, axis), second),
    crossingPoint(first, movedLine(second, offset, axis)),
  ]);

  const kept = [
    crossingPoint(first, second),
    crossingPoint(
      movedLine(first, real[first.id] ?? 0, axis),
      movedLine(second, real[second.id] ?? 0, axis),
    ),
  ];

  const upper = {
    x: Math.max(...reachable.map((point) => point.x)) * HEADROOM,
    y:
      Math.max(...reachable.map((point) => point.y), ...lines.map((line) => line.intercept)) *
      HEADROOM,
  };

  return {
    max: upper,
    min: {
      x: lowerBound(Math.min(...kept.map((point) => point.x)), upper.x),
      y: lowerBound(Math.min(...kept.map((point) => point.y)), upper.y),
    },
  };
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

export function visibleSegment(line: Line, domain: ChartDomain): { from: Point; to: Point } {
  const { from, to } = spanInside(line, domain.min, domain.max) ?? { from: 0, to: 0 };
  return { from: { x: from, y: yAt(line, from) }, to: { x: to, y: yAt(line, to) } };
}

/**
 * Where a saved answer puts its line again, since it keeps only the direction: as far as the real
 * move, or the furthest allowed stop that way.
 */
export function restoredOffset({
  amount,
  direction,
  range,
}: {
  amount: number;
  direction: Direction;
  range: SnapRange;
}): number {
  return clamp(
    direction === "right" || direction === "up" ? amount : -amount,
    range.min,
    range.max,
  );
}

export function changeDirection(before: number, after: number): "down" | "same" | "up" {
  const slack = Math.max(Math.abs(before), 1) * RELATIVE_SLACK;

  if (Math.abs(after - before) <= slack) {
    return "same";
  }

  return after > before ? "up" : "down";
}

type HandleOption = { crossings: Point[]; rest: Point; slide: LineSlide; stops: Point[] };

/**
 * How a line's handle can slide: twice the real shift each way, as far as the line still passes
 * through the chart inset by a handle's margin. At each shift the handle rides its moved line,
 * at the point nearest its resting spot inside that inset. Its resting spots, nearest 82% along
 * the line first, are those clear of the resting crossing, kept inside the inset. `crossings` are
 * where the line meets `other` at each shift.
 */
function handleOptions({
  amount,
  axis,
  crossing: restingCrossing,
  domain,
  line,
  other,
}: {
  amount: number;
  axis: ShiftAxis;
  crossing: Point;
  domain: ChartDomain;
  line: Line;
  other: Line;
}): HandleOption[] {
  const size = { x: domain.max.x - domain.min.x, y: domain.max.y - domain.min.y };
  const margin = { x: size.x * HANDLE_MARGIN, y: size.y * HANDLE_MARGIN };
  const low = { x: domain.min.x + margin.x, y: domain.min.y + margin.y };
  const high = { x: domain.max.x - margin.x, y: domain.max.y - margin.y };
  const full = shiftRange(amount);
  const count = Math.round((full.max - full.min) / full.step) + 1;

  const offsets = Array.from({ length: count }, (_, index) =>
    snapToStep(full.min + index * full.step, full),
  ).filter((offset) => spanInside(movedLine(line, offset, axis), low, high));

  const visible = spanInside(line, domain.min, domain.max) ?? { from: 0, to: 0 };
  const resting = spanInside(line, low, high) ?? visible;
  const range = { max: Math.max(...offsets), min: Math.min(...offsets), step: full.step };
  const crossings = offsets.map((offset) => crossingPoint(movedLine(line, offset, axis), other));

  const along = (share: number) =>
    clamp(visible.from + (visible.to - visible.from) * share, resting.from, resting.to);

  const isClear = (x: number) =>
    Math.hypot((x - restingCrossing.x) / size.x, (yAt(line, x) - restingCrossing.y) / size.y) >=
    CROSSING_GAP;

  const option = (homeX: number): HandleOption => {
    const at = (offset: number): Point => {
      const moved = movedLine(line, offset, axis);
      const preferred = axis === "horizontal" ? homeX + offset : homeX;
      const span = spanInside(moved, low, high);
      const x = span ? clamp(preferred, span.from, span.to) : preferred;
      return { x, y: yAt(moved, x) };
    };

    return {
      crossings,
      rest: at(0),
      slide: { at, offsets, range },
      stops: offsets.map((offset) => at(offset)),
    };
  };

  const shares = HANDLE_SHARES.filter((share) => isClear(along(share)));
  return (shares.length > 0 ? shares : [HANDLE_SHARE]).map((share) => option(along(share)));
}

/** Whether a stop lies between a line's rest and its real answer, where a learner passes. */
function isOnTheWay(offset: number, realOffset: number): boolean {
  return offset >= Math.min(0, realOffset) && offset <= Math.max(0, realOffset);
}

/**
 * What a pair of resting handles costs, compared in order: on the screens that stay, at rest and at
 * the real answer, a handle on the other handle or under the crossing; the stops on the way to the
 * answer where the moving handle lands on the other's rest; the same at the other stops; the stops
 * where the crossing, sliding along the other line, passes over a resting handle.
 */
function pairCost({
  domain,
  first,
  real,
  second,
}: {
  domain: ChartDomain;
  first: HandleOption;
  real: { crossing: Point; offsets: [number, number] };
  second: HandleOption;
}): [number, number, number, number] {
  const size = { x: domain.max.x - domain.min.x, y: domain.max.y - domain.min.y };

  const near = (points: Point[], to: Point, gap: number) =>
    points.filter((point) => Math.hypot((point.x - to.x) / size.x, (point.y - to.y) / size.y) < gap)
      .length;

  const atReal = [first.slide.at(real.offsets[0]), second.slide.at(real.offsets[1])];
  const [firstAtReal = first.rest, secondAtReal = second.rest] = atReal;

  const stops = (option: HandleOption, realOffset: number, onTheWay: boolean) =>
    option.stops.filter(
      (_, index) => isOnTheWay(option.slide.offsets[index] ?? 0, realOffset) === onTheWay,
    );

  const handlesMet = (onTheWay: boolean) =>
    near(stops(first, real.offsets[0], onTheWay), second.rest, HANDLES_APART) +
    near(stops(second, real.offsets[1], onTheWay), first.rest, HANDLES_APART);

  return [
    near([first.rest], second.rest, HANDLES_APART) +
      near([firstAtReal], secondAtReal, HANDLES_APART) +
      near(atReal, real.crossing, CROSSING_GAP),
    handlesMet(true),
    handlesMet(false),
    near(first.crossings, second.rest, CROSSING_GAP) +
      near(second.crossings, first.rest, CROSSING_GAP),
  ];
}

/** Only one line moves at a time. The handles rest at the cheapest pair, nearest 82% first. */
function handlePair({
  domain,
  firsts,
  real,
  seconds,
}: {
  domain: ChartDomain;
  firsts: HandleOption[];
  real: { crossing: Point; offsets: [number, number] };
  seconds: HandleOption[];
}): { first: HandleOption; second: HandleOption } {
  const pairs = firsts.flatMap((first) =>
    seconds.map((second) => ({ cost: pairCost({ domain, first, real, second }), first, second })),
  );

  const isCheaper = (pair: (typeof pairs)[number], best: (typeof pairs)[number]) => {
    const differs = pair.cost.findIndex((cost, index) => cost !== best.cost[index]);
    return differs !== -1 && (pair.cost[differs] ?? 0) < (best.cost[differs] ?? 0);
  };

  return pairs.reduce((best, pair) => (isCheaper(pair, best) ? pair : best));
}

export function chartSlides<TLine extends NamedLine>({
  amount,
  axis,
  lines,
  real,
}: {
  amount: number;
  axis: ShiftAxis;
  lines: readonly [TLine, TLine];
  real: LineOffsets;
}): { domain: ChartDomain; slides: { line: TLine; slide: LineSlide }[] } {
  const domain = chartDomain({ amount, axis, lines, real });
  const [first, second] = lines;
  const rest = crossingPoint(first, second);

  const options = (line: Line, other: Line) =>
    handleOptions({ amount, axis, crossing: rest, domain, line, other });

  const realOffsets: [number, number] = [real[first.id] ?? 0, real[second.id] ?? 0];

  const chosen = handlePair({
    domain,
    firsts: options(first, second),
    real: {
      crossing: crossingPoint(
        movedLine(first, realOffsets[0], axis),
        movedLine(second, realOffsets[1], axis),
      ),
      offsets: realOffsets,
    },
    seconds: options(second, first),
  });

  return {
    domain,
    slides: [
      { line: first, slide: chosen.first.slide },
      { line: second, slide: chosen.second.slide },
    ],
  };
}
