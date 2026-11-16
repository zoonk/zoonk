import { describe, expect, it } from "vitest";
import { touchesSegment } from "../_utils/drawing-label";
import { type DialLabelPlacement, angleLabelPoint, sinLabelPlacement } from "./unit-circle-label";

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

describe(angleLabelPoint, () => {
  const size = { height: 17, width: 28 };
  const zeroRay = { from: center, to: { x: center.x + radius, y: center.y } };

  function angleBox(degrees: number) {
    const point = onCircle(degrees);
    const cosPoint = { x: (center.x + point.x) / 2, y: center.y + 16 };
    const cos = { point: cosPoint, size: { height: 17, width: 66 } };
    const at = angleLabelPoint({ center, cos, degrees, from: 38, radius, size });

    return {
      box: {
        bottom: at.y + size.height / 2,
        left: at.x - size.width / 2,
        right: at.x + size.width / 2,
        top: at.y - size.height / 2,
      },
      direction: (Math.atan2(center.y - at.y, at.x - center.x) * 180) / Math.PI,
      radiusLine: { from: center, to: point },
      sinLeg: { from: { x: point.x, y: center.y }, to: point },
    };
  }

  it("sets the angle inside its wedge, off the radius and the axis", () => {
    const { box, direction, radiusLine, sinLeg } = angleBox(30);

    expect(direction).toBeGreaterThan(0);
    expect(direction).toBeLessThan(30);

    expect(touchesSegment(box, radiusLine)).toBe(false);
    expect(touchesSegment(box, zeroRay)).toBe(false);
    expect(touchesSegment(box, sinLeg)).toBe(false);
  });

  it("sets a wedge too thin for it just past the radius, still off both lines", () => {
    const { box, radiusLine } = angleBox(8);

    expect(touchesSegment(box, radiusLine)).toBe(false);
    expect(touchesSegment(box, zeroRay)).toBe(false);
  });

  it("keeps the label off both whole axes, whatever the angle", () => {
    const axes = [
      { from: { x: center.x - radius, y: center.y }, to: { x: center.x + radius, y: center.y } },
      { from: { x: center.x, y: center.y - radius }, to: { x: center.x, y: center.y + radius } },
    ];

    const crossing = [90, 135, 180, 225, 270].filter((degrees) =>
      axes.some((axis) => touchesSegment(angleBox(degrees).box, axis)),
    );

    expect(crossing).toStrictEqual([]);
  });

  it("keeps a wide angle on its bisector, off both lines", () => {
    const { box, radiusLine } = angleBox(300);

    expect(touchesSegment(box, radiusLine)).toBe(false);
    expect(touchesSegment(box, zeroRay)).toBe(false);
  });
});
