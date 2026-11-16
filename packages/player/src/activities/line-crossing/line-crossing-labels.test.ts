import { describe, expect, it } from "vitest";
import {
  ARROW_HEAD,
  ARROW_STROKE,
  type LabelBox,
  changeArrows,
  placeChartLabels,
  placeLineLabels,
} from "./line-crossing-labels";
import { type Point } from "./line-crossing-model";

const area = { bottom: 222, left: 22, right: 311, top: 26 };
const size = { height: 12, width: 50 };
const noMarks = { boxes: [], circles: [], lines: [] };

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

  it("puts a dashed copy's name under its line, at the end where the line names sit", () => {
    const segment = { from: { x: 22, y: 150 }, to: { x: 293, y: 90 } };

    const [box] = placeLineLabels({
      area,
      labels: [{ isUpper: false, segment, size }],
      marks: noMarks,
    });

    expect(box?.right).toBeGreaterThan(250);
    expect(box?.top).toBeGreaterThan(150 + ((90 - 150) * ((box?.right ?? 0) - 22)) / (293 - 22));
    expect(box && gapToSegment(box, segment)).toBeGreaterThanOrEqual(3);
  });

  it("keeps a name nearer its own line than any other line", () => {
    const revenue = { from: { x: 22, y: 218 }, to: { x: 558, y: 27 } };
    const cost = { from: { x: 22, y: 150 }, to: { x: 558, y: 86 } };
    const answer = { from: { x: 22, y: 133 }, to: { x: 554, y: 70 } };
    const wide = { height: 12, width: 88 };

    const boxes = placeLineLabels({
      area: { bottom: 218, left: 22, right: 558, top: 26 },
      labels: [
        { isUpper: true, segment: revenue, size: { height: 12, width: 50 } },
        { isUpper: true, segment: cost, size: { height: 12, width: 28 } },
        { isUpper: false, segment: answer, size: wide },
      ],
      marks: {
        boxes: [],
        circles: [
          { cx: 461, cy: 62, radius: 15 },
          { cx: 461, cy: 98, radius: 15 },
          { cx: 308, cy: 116, radius: 7 },
        ],
        lines: [revenue, cost, answer],
      },
    });

    const box = boxes[2];

    expect(box && gapToSegment(box, answer)).toBeLessThan(box ? gapToSegment(box, cost) : 0);
    expect(box && gapToSegment(box, answer)).toBeLessThan(box ? gapToSegment(box, revenue) : 0);
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
      marks: { ...noMarks, boxes: [arrow], circles: [everywhere] },
    });

    expect(box && gapToBox(box, arrow)).toBeGreaterThanOrEqual(3);
    expect(box && gapToSegment(box, segment)).toBeGreaterThanOrEqual(3);
  });

  it("leaves an optional name out when no spot clears the marks, and keeps the others", () => {
    const segment = { from: { x: 22, y: 222 }, to: { x: 293, y: 26 } };
    const everywhere = { cx: 166, cy: 124, radius: 400 };

    const [name, optional] = placeLineLabels({
      area,
      labels: [
        { isUpper: true, segment, size },
        { isOptional: true, isUpper: false, segment, size },
      ],
      marks: { ...noMarks, circles: [everywhere] },
    });

    expect(name).not.toBeNull();
    expect(optional).toBeNull();
  });
});

describe(placeChartLabels, () => {
  const revenue = {
    isUpper: true,
    segment: { from: { x: 22, y: 222 }, to: { x: 311, y: 60 } },
    size,
  };

  const cost = {
    isUpper: true,
    segment: { from: { x: 22, y: 170 }, to: { x: 311, y: 120 } },
    size,
  };

  const answer = {
    isUpper: false,
    segment: { from: { x: 22, y: 150 }, to: { x: 311, y: 100 } },
    size,
  };

  it("keeps the names already shown in place when the answer's line and name appear", () => {
    const before = placeChartLabels({ area, marks: noMarks, revealed: [], shown: [revenue, cost] });

    const after = placeChartLabels({
      area,
      marks: noMarks,
      revealed: [answer],
      shown: [revenue, cost],
    });

    expect(after.slice(0, 2)).toStrictEqual(before);
    expect(after[2]).not.toBeNull();
  });

  it("keeps the answer's name nearer the answer's line than the lines shown before it", () => {
    const box = placeChartLabels({
      area,
      marks: noMarks,
      revealed: [answer],
      shown: [revenue, cost],
    }).at(2);

    if (!box) {
      throw new Error("The answer's name found no spot.");
    }

    expect(gapToSegment(box, answer.segment)).toBeLessThan(
      Math.min(gapToSegment(box, cost.segment), gapToSegment(box, revenue.segment)),
    );
  });
});

describe(changeArrows, () => {
  const corner = { bottom: 218, left: 22 };
  const head = (ARROW_HEAD * ARROW_STROKE) / 2;

  it("draws each arrow between the guides it spans, its head clear of the axis", () => {
    const [up, along] = changeArrows({
      after: { x: 260, y: 80 },
      before: { x: 300, y: 120 },
      ...corner,
    });

    expect(up?.from.y).toBeLessThan(120);
    expect(up?.to.y).toBeGreaterThan(80);
    expect((up?.from.x ?? 0) - head - corner.left).toBeGreaterThanOrEqual(6);
    expect(along?.from.x).toBeLessThan(300);
    expect(along?.to.x).toBeGreaterThan(260);
    expect(corner.bottom - (along?.from.y ?? 0) - head).toBeGreaterThanOrEqual(6);
  });

  it("leaves out an arrow too short to show more than its head", () => {
    const arrows = changeArrows({
      after: { x: 260, y: 110 },
      before: { x: 300, y: 120 },
      ...corner,
    });

    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.from.y).toBe(arrows[0]?.to.y);
  });
});
