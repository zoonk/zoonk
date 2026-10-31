import { describe, expect, it } from "vitest";
import { type LabelBox, placeLineLabels } from "./line-crossing-labels";
import { type Point } from "./line-crossing-model";

const area = { bottom: 222, left: 22, right: 311, top: 26 };
const size = { height: 12, width: 50 };
const noMarks = { arrows: [], circles: [], lines: [] };

function gapToSegment(box: LabelBox, { from, to }: { from: Point; to: Point }): number {
  const samples = Array.from({ length: 201 }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / 200,
    y: from.y + ((to.y - from.y) * index) / 200,
  }));

  return Math.min(
    ...samples.map((point) =>
      Math.hypot(
        Math.max(box.left - point.x, 0, point.x - box.right),
        Math.max(box.top - point.y, 0, point.y - box.bottom),
      ),
    ),
  );
}

function gapToBox(box: LabelBox, other: LabelBox): number {
  return Math.hypot(
    Math.max(other.left - box.right, 0, box.left - other.right),
    Math.max(other.top - box.bottom, 0, box.top - other.bottom),
  );
}

describe(placeLineLabels, () => {
  it("keeps a name off its line where the line leaves through the chart's top", () => {
    const segment = { from: { x: 22, y: 222 }, to: { x: 293, y: 26 } };

    const [box] = placeLineLabels({
      area,
      labels: [{ isUpper: true, segment, size }],
      marks: noMarks,
    });

    expect(box && gapToSegment(box, segment)).toBeGreaterThanOrEqual(3);
    expect(box && gapToSegment(box, segment)).toBeLessThan(20);
  });

  it("puts a lower end's name under its line", () => {
    const segment = { from: { x: 22, y: 150 }, to: { x: 293, y: 90 } };

    const [box] = placeLineLabels({
      area,
      labels: [{ isUpper: false, segment, size }],
      marks: noMarks,
    });

    expect(box?.top).toBeGreaterThan(150);
    expect(box && gapToSegment(box, segment)).toBeGreaterThanOrEqual(3);
  });

  it("moves a name off a drag handle in its way", () => {
    const segment = { from: { x: 22, y: 160 }, to: { x: 293, y: 100 } };
    const handle = { cx: 262, cy: 80, radius: 15 };

    const [box] = placeLineLabels({
      area,
      labels: [{ isUpper: true, segment, size }],
      marks: { ...noMarks, circles: [handle] },
    });

    const nearest = {
      x: Math.min(Math.max(handle.cx, box?.left ?? 0), box?.right ?? 0),
      y: Math.min(Math.max(handle.cy, box?.top ?? 0), box?.bottom ?? 0),
    };

    expect(Math.hypot(nearest.x - handle.cx, nearest.y - handle.cy)).toBeGreaterThan(handle.radius);
  });

  it("keeps two names from covering each other", () => {
    const first = { from: { x: 22, y: 200 }, to: { x: 293, y: 100 } };
    const second = { from: { x: 22, y: 210 }, to: { x: 293, y: 104 } };

    const [one, two] = placeLineLabels({
      area,
      labels: [
        { isUpper: true, segment: first, size },
        { isUpper: true, segment: second, size },
      ],
      marks: noMarks,
    });

    const overlaps =
      one &&
      two &&
      one.left < two.right &&
      two.left < one.right &&
      one.top < two.bottom &&
      two.top < one.bottom;

    expect(overlaps).toBe(false);
  });

  it("keeps a name inside the chart and off its line when no spot nearby is free", () => {
    const segment = { from: { x: 22, y: 222 }, to: { x: 293, y: 26 } };
    const everywhere = { cx: 166, cy: 124, radius: 400 };

    const [box] = placeLineLabels({
      area,
      labels: [{ isUpper: true, segment, size }],
      marks: { ...noMarks, circles: [everywhere] },
    });

    expect(box?.top).toBeGreaterThanOrEqual(area.top);
    expect(box && gapToSegment(box, segment)).toBeGreaterThanOrEqual(3);
  });

  it("finds room for a long name away from its line rather than across it", () => {
    const segment = { from: { x: 22, y: 218 }, to: { x: 293, y: 26 } };

    const [box] = placeLineLabels({
      area,
      labels: [{ isUpper: true, segment, size: { height: 24, width: 240 } }],
      marks: noMarks,
    });

    expect(box && gapToSegment(box, segment)).toBeGreaterThanOrEqual(3);
    expect(box?.top).toBeGreaterThanOrEqual(area.top);
    expect(box?.bottom).toBeLessThanOrEqual(area.bottom);
  });

  it("keeps a name too wide for the chart off its line, by its end", () => {
    const segment = { from: { x: 22, y: 218 }, to: { x: 293, y: 26 } };

    const [box] = placeLineLabels({
      area,
      labels: [{ isUpper: true, segment, size: { height: 24, width: 320 } }],
      marks: noMarks,
    });

    expect(box && gapToSegment(box, segment)).toBeGreaterThanOrEqual(3);
  });

  it("keeps a name clear of an arrow, head included, even when no spot nearby is free", () => {
    const segment = { from: { x: 22, y: 222 }, to: { x: 293, y: 26 } };
    const everywhere = { cx: 166, cy: 124, radius: 400 };
    const arrow = { bottom: 87, left: 230, right: 244, top: 26 };

    const [box] = placeLineLabels({
      area,
      labels: [{ isUpper: true, segment, size }],
      marks: { ...noMarks, arrows: [arrow], circles: [everywhere] },
    });

    expect(box && gapToBox(box, arrow)).toBeGreaterThanOrEqual(3);
    expect(box && gapToSegment(box, segment)).toBeGreaterThanOrEqual(3);
  });
});
