import { describe, expect, it } from "vitest";
import { type DialLabelPlacement, sinLabelPlacement } from "./unit-circle-label";

const HALF_TURN = 180;
const center = { x: 155, y: 150 };
const radius = 102;

function onCircle(degrees: number) {
  const radians = (degrees * Math.PI) / HALF_TURN;
  return { x: center.x + Math.cos(radians) * radius, y: center.y - Math.sin(radians) * radius };
}

function boxOf(
  { anchor, baseline, point }: DialLabelPlacement,
  size: { height: number; width: number },
) {
  const left = { end: point.x - size.width, middle: point.x - size.width / 2, start: point.x }[
    anchor
  ];

  const top = {
    middle: point.y - size.height / 2,
    "text-after-edge": point.y - size.height,
    "text-before-edge": point.y,
  }[baseline];

  return { bottom: top + size.height, left, right: left + size.width, top };
}

function crossesCircle(box: ReturnType<typeof boxOf>): boolean {
  const nearest = Math.hypot(
    Math.min(Math.max(center.x, box.left), box.right) - center.x,
    Math.min(Math.max(center.y, box.top), box.bottom) - center.y,
  );

  const farthest = Math.max(
    ...[box.left, box.right].flatMap((x) =>
      [box.top, box.bottom].map((y) => Math.hypot(x - center.x, y - center.y)),
    ),
  );

  return nearest < radius + 3 && farthest > radius - 3;
}

function place(degrees: number, label: { height: number; width: number }, width: number) {
  return sinLabelPlacement({
    canvas: { width },
    center,
    label,
    point: onCircle(degrees),
    radius,
    target: null,
  });
}

describe(sinLabelPlacement, () => {
  it("keeps the label off the circle when a phone has no room beside the point", () => {
    const label = { height: 17, width: 50 };
    const box = boxOf(place(0, label, 310), label);

    expect(crossesCircle(box)).toBe(false);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(310);
  });

  it("keeps a longer label off the circle at a small angle on a phone", () => {
    const label = { height: 17, width: 70 };
    const box = boxOf(place(10, label, 310), label);

    expect(crossesCircle(box)).toBe(false);
    expect(box.right).toBeLessThanOrEqual(310);
  });

  it("keeps a label beside its leg off the circle's line", () => {
    const label = { height: 17, width: 66 };
    expect(crossesCircle(boxOf(place(60, label, 576), label))).toBe(false);
  });

  it("sets the label beside its leg where there's room", () => {
    const point = onCircle(0);

    expect(place(0, { height: 17, width: 50 }, 576)).toStrictEqual({
      anchor: "start",
      baseline: "middle",
      point: { x: point.x + 26, y: point.y },
    });
  });
});
