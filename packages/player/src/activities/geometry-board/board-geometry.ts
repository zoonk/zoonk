import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { isMultiple, snapToStep } from "../_utils/snap-value";

type BoardFields = ActivityContentFor<"geometryBoard">["fields"];
export type BoardPoint = BoardFields["points"][number];
export type BoardMeasure = BoardFields["measure"];
export type BoardBounds = { maxX: number; maxY: number; minX: number; minY: number };
type Vector = { x: number; y: number };

const HALF_TURN = 180;
/* oxlint-disable-next-line no-magic-numbers -- Round grid steps, largest first. */
const GRID_STEPS = [10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.01] as const;
const MIN_POSITIONS = 4;
const MARGIN_SHARE = 0.25;
const SQUARES_MARGIN_SHARE = 0.1;
const MIN_AREA_SHARE = 0.05;
const MIN_ANGLE = 3;

function sub(to: Vector, from: Vector): Vector {
  return { x: to.x - from.x, y: to.y - from.y };
}

function cross(first: Vector, second: Vector): number {
  return first.x * second.y - first.y * second.x;
}

function dot(first: Vector, second: Vector): number {
  return first.x * second.x + first.y * second.y;
}

function toDegrees(radians: number): number {
  return (radians * HALF_TURN) / Math.PI;
}

function around<T>(items: readonly T[], index: number): T {
  const item = items[(index + items.length) % items.length];

  if (item === undefined) {
    throw new Error("A polygon needs at least one corner");
  }

  return item;
}

function signedArea(points: readonly Vector[]): number {
  return points.reduce((sum, point, index) => sum + cross(point, around(points, index + 1)), 0) / 2;
}

export function polygonArea(points: readonly Vector[]): number {
  return Math.abs(signedArea(points));
}

export function sideLengths(points: readonly Vector[]): number[] {
  return points.map((point, index) => {
    const side = sub(around(points, index + 1), point);
    return Math.hypot(side.x, side.y);
  });
}

export function interiorAngles(points: readonly Vector[]): number[] {
  const winding = Math.sign(signedArea(points)) || 1;

  return points.map((point, index) => {
    const incoming = sub(point, around(points, index - 1));
    const outgoing = sub(around(points, index + 1), point);
    const turn = toDegrees(Math.atan2(cross(incoming, outgoing), dot(incoming, outgoing)));

    return HALF_TURN - winding * turn;
  });
}

export function roundParts(values: readonly number[], digits: number): number[] {
  const scale = 10 ** digits;
  const scaled = values.map((value) => value * scale);
  const floors = scaled.map((value) => Math.floor(value));
  const total = Math.round(scaled.reduce((sum, value) => sum + value, 0));
  const missing = total - floors.reduce((sum, value) => sum + value, 0);

  const bumped = new Set(
    scaled
      .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
      .toSorted((first, second) => second.remainder - first.remainder)
      .slice(0, Math.max(missing, 0))
      .map((item) => item.index),
  );

  return floors.map((floor, index) => (floor + (bumped.has(index) ? 1 : 0)) / scale);
}

export function sideSquares(points: readonly Vector[]): Vector[][] {
  const winding = Math.sign(signedArea(points)) || 1;

  return points.map((point, index) => {
    const next = around(points, index + 1);
    const side = sub(next, point);
    const outward = { x: winding * side.y, y: -winding * side.x };

    return [
      point,
      next,
      { x: next.x + outward.x, y: next.y + outward.y },
      { x: point.x + outward.x, y: point.y + outward.y },
    ];
  });
}

export function gridStep(points: readonly Vector[]): number {
  const values = points.flatMap((point) => [point.x, point.y]);

  const span = Math.max(
    Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)),
    Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)),
  );

  return (
    GRID_STEPS.find(
      (step) => span / step >= MIN_POSITIONS && values.every((value) => isMultiple(value, step)),
    ) ?? span / (MIN_POSITIONS * MIN_POSITIONS)
  );
}

export function boardBounds({
  measure,
  points,
  step,
}: {
  measure: BoardMeasure;
  points: readonly Vector[];
  step: number;
}): BoardBounds {
  const drawn = measure === "pythagoras" ? sideSquares(points).flat() : points;
  const [xs, ys] = [drawn.map((point) => point.x), drawn.map((point) => point.y)];
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const share = measure === "pythagoras" ? SQUARES_MARGIN_SHARE : MARGIN_SHARE;
  const margin = Math.max(step, span * share);

  return {
    maxX: Math.ceil((Math.max(...xs) + margin) / step) * step,
    maxY: Math.ceil((Math.max(...ys) + margin) / step) * step,
    minX: Math.floor((Math.min(...xs) - margin) / step) * step,
    minY: Math.floor((Math.min(...ys) - margin) / step) * step,
  };
}

function isInside(point: Vector, bounds: BoardBounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

function segmentsCross(
  [start, end]: [Vector, Vector],
  [otherStart, otherEnd]: [Vector, Vector],
): boolean {
  const direction = sub(end, start);
  const otherDirection = sub(otherEnd, otherStart);

  const splitsOther =
    cross(direction, sub(otherStart, start)) * cross(direction, sub(otherEnd, start)) < 0;

  const splitsThis =
    cross(otherDirection, sub(start, otherStart)) * cross(otherDirection, sub(end, otherStart)) < 0;

  return splitsOther && splitsThis;
}

function crossesItself(points: readonly Vector[]): boolean {
  const sides = points.map((point, index): [Vector, Vector] => [point, around(points, index + 1)]);

  return sides.some((side, index) =>
    sides.some(
      (other, otherIndex) =>
        otherIndex > index + 1 &&
        !(index === 0 && otherIndex === sides.length - 1) &&
        segmentsCross(side, other),
    ),
  );
}

function isValidShape({
  bounds,
  measure,
  minArea,
  points,
}: {
  bounds: BoardBounds;
  measure: BoardMeasure;
  minArea: number;
  points: readonly Vector[];
}): boolean {
  const drawn = measure === "pythagoras" ? sideSquares(points).flat() : points;
  const angles = interiorAngles(points);

  return (
    drawn.every((point) => isInside(point, bounds)) &&
    polygonArea(points) >= minArea &&
    angles.every((angle) => angle >= MIN_ANGLE && Math.abs(angle - HALF_TURN) >= MIN_ANGLE) &&
    !crossesItself(points)
  );
}

export function minimumArea(points: readonly Vector[]): number {
  return polygonArea(points) * MIN_AREA_SHARE;
}

export function moveCorner({
  bounds,
  index,
  measure,
  minArea,
  points,
  step,
  to,
}: {
  bounds: BoardBounds;
  index: number;
  measure: BoardMeasure;
  minArea: number;
  points: readonly BoardPoint[];
  step: number;
  to: Vector;
}): BoardPoint[] | null {
  const corner = points[index];

  if (!corner?.movable) {
    return null;
  }

  const moved = {
    ...corner,
    x:
      corner.track === "vertical"
        ? corner.x
        : snapToStep(to.x, { max: bounds.maxX, min: bounds.minX, step }),
    y:
      corner.track === "horizontal"
        ? corner.y
        : snapToStep(to.y, { max: bounds.maxY, min: bounds.minY, step }),
  };

  const next = points.map((point, pointIndex) => (pointIndex === index ? moved : point));

  return isValidShape({ bounds, measure, minArea, points: next }) ? next : null;
}

export function keyOffset({
  key,
  step,
  track,
}: {
  key: string;
  step: number;
  track: BoardPoint["track"];
}): Vector | null {
  const offsets: Record<string, Vector> = {
    ArrowDown: { x: 0, y: -step },
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: step },
  };

  const offset = offsets[key];

  if (!offset || !track) {
    return offset ?? null;
  }

  const amount = offset.x + offset.y;
  return track === "horizontal" ? { x: amount, y: 0 } : { x: 0, y: amount };
}

export function hasMoved(points: readonly Vector[], start: readonly Vector[]): boolean {
  return points.some((point, index) => point.x !== start[index]?.x || point.y !== start[index]?.y);
}
