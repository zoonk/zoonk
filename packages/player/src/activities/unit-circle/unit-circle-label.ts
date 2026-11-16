import { LABEL_CLEARANCE, touchesSegment } from "../_utils/drawing-label";
import { clamp } from "../_utils/snap-value";

type Vector = { x: number; y: number };
type Size = { height: number; width: number };
type Box = { bottom: number; left: number; right: number; top: number };

export type LabelBaseline = "middle" | "text-after-edge" | "text-before-edge";
export type DialLabelPlacement = {
  anchor: "end" | "middle" | "start";
  baseline: LabelBaseline;
  point: Vector;
};

const SIN_LABEL_GAP = 26;
const SIN_LABEL_PAST_POINT = 25;
const CIRCLE_STROKE = 2;
const HALO_REACH = 2;
const RING_GAP = CIRCLE_STROKE / 2 + HALO_REACH + LABEL_CLEARANCE;

/** Clear when the box sits wholly inside the circle or wholly outside it, its halo off the line. */
function isClearOfCircle(box: Box, center: Vector, radius: number): boolean {
  const nearest = Math.hypot(
    clamp(center.x, box.left, box.right) - center.x,
    clamp(center.y, box.top, box.bottom) - center.y,
  );

  const farthest = Math.max(
    ...[box.left, box.right].flatMap((x) =>
      [box.top, box.bottom].map((y) => Math.hypot(x - center.x, y - center.y)),
    ),
  );

  return farthest <= radius - RING_GAP || nearest >= radius + RING_GAP;
}

/**
 * Past the point (and a target in the way), on the circle's outside: as close to over the leg as
 * the canvas allows, sliding out sideways and then further past the point until the circle's line
 * no longer runs under it. Measured outward from the center, `across` sideways and `past` up or
 * down.
 */
function pastPoint({
  canvas,
  center,
  foot,
  isAbove,
  isLeft,
  label,
  outermost,
  radius,
}: {
  canvas: { width: number };
  center: Vector;
  foot: Vector;
  isAbove: boolean;
  isLeft: boolean;
  label: Size;
  outermost: number;
  radius: number;
}): DialLabelPlacement {
  const ring = radius + RING_GAP;
  const outward = isLeft ? center.x : canvas.width - center.x;
  const inward = isLeft ? canvas.width - center.x : center.x;
  const farthestStart = outward - label.width;

  const clearAt =
    farthestStart >= 0 ? Math.sqrt(Math.max(ring ** 2 - farthestStart ** 2, 0)) : ring;

  const past = Math.max(Math.abs(outermost - center.y) + SIN_LABEL_PAST_POINT, clearAt);
  const clearStart = past >= ring ? -inward : Math.sqrt(ring ** 2 - past ** 2);

  const start = clamp(
    Math.max(Math.abs(foot.x - center.x) - label.width / 2, clearStart),
    -inward,
    farthestStart,
  );

  return {
    anchor: isLeft ? "end" : "start",
    baseline: isAbove ? "text-after-edge" : "text-before-edge",
    point: { x: center.x + (isLeft ? -start : start), y: center.y + (isAbove ? -past : past) },
  };
}

/** Beside the sine's leg where it has room and stays off the circle's line; otherwise past the point, outside the circle. */
export function sinLabelPlacement({
  canvas,
  center,
  label,
  point,
  radius,
  target,
}: {
  canvas: { width: number };
  center: Vector;
  label: Size;
  point: Vector;
  radius: number;
  target: Vector | null;
}): DialLabelPlacement {
  const foot = { x: point.x, y: center.y };
  const isLeft = point.x < center.x;
  const isAbove = point.y <= center.y;
  const beside = foot.x + (isLeft ? -1 : 1) * SIN_LABEL_GAP;
  const middle = (foot.y + point.y) / 2;
  const left = isLeft ? beside - label.width : beside;

  const besideBox = {
    bottom: middle + label.height / 2,
    left,
    right: left + label.width,
    top: middle - label.height / 2,
  };

  if (
    besideBox.left >= 0 &&
    besideBox.right <= canvas.width &&
    isClearOfCircle(besideBox, center, radius)
  ) {
    return {
      anchor: isLeft ? "end" : "start",
      baseline: "middle",
      point: { x: beside, y: middle },
    };
  }

  const isTargetPast =
    target !== null &&
    Math.abs(target.x - point.x) < label.width &&
    (isAbove ? target.y < point.y : target.y > point.y);

  return pastPoint({
    canvas,
    center,
    foot,
    isAbove,
    isLeft,
    label,
    outermost: isTargetPast ? target.y : point.y,
    radius,
  });
}

const HALF_TURN = 180;
const AXIS_CLEARANCE = 25;
const ANGLE_LABEL_STEP = 1;
const ANGLE_LABEL_TURN = 1;
const ANGLE_LABEL_STEPS = 60;
const LABEL_APART = 4;

export function onCircle(center: Vector, radius: number, degrees: number): Vector {
  const radians = (degrees * Math.PI) / HALF_TURN;
  return { x: center.x + Math.cos(radians) * radius, y: center.y - Math.sin(radians) * radius };
}

function isApart(first: Vector, firstSize: Size, second: Vector, secondSize: Size): boolean {
  return (
    Math.abs(first.x - second.x) >= (firstSize.width + secondSize.width) / 2 + LABEL_APART ||
    Math.abs(first.y - second.y) >= (firstSize.height + secondSize.height) / 2 + LABEL_APART
  );
}

/**
 * The angle's value sits inside its wedge, as close to the arc and to the bisector as clears the
 * two lines the angle lies between, the sine's leg and the cos value. A wedge too thin for it puts
 * it just past the radius instead, clear of the same lines.
 */
export function angleLabelPoint({
  center,
  cos,
  degrees,
  from,
  radius,
  size,
}: {
  center: Vector;
  cos: { point: Vector; size: Size } | null;
  degrees: number;
  from: number;
  radius: number;
  size: Size;
}): Vector {
  const point = onCircle(center, radius, degrees);

  const lines = [
    { from: center, to: { x: center.x + radius, y: center.y } },
    { from: center, to: point },
    { from: { x: point.x, y: center.y }, to: point },
  ];

  const isClear = (at: Vector) => {
    const box = {
      bottom: at.y + size.height / 2,
      left: at.x - size.width / 2,
      right: at.x + size.width / 2,
      top: at.y - size.height / 2,
    };

    return (
      lines.every((line) => !touchesSegment(box, line)) &&
      (!cos || isApart(at, size, cos.point, cos.size))
    );
  };

  const distances = Array.from(
    { length: ANGLE_LABEL_STEPS + 1 },
    (_, step) => from + step * ANGLE_LABEL_STEP,
  ).filter((distance) => distance < radius);

  const turns = Array.from({ length: Math.floor(degrees / 2 / ANGLE_LABEL_TURN) }, (_, step) => [
    degrees / 2 - (step + 1) * ANGLE_LABEL_TURN,
    degrees / 2 + (step + 1) * ANGLE_LABEL_TURN,
  ]).flat();

  const inside = distances.flatMap((distance) =>
    [degrees / 2, ...turns].map((direction) => onCircle(center, distance, direction)),
  );

  const past = distances.map((distance) => onCircle(center, distance, degrees + AXIS_CLEARANCE));
  const spots = [...inside, ...past];

  return spots.find((at) => isClear(at)) ?? onCircle(center, from, degrees + AXIS_CLEARANCE);
}
