import { LABEL_CLEARANCE } from "../_utils/drawing-label";
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
