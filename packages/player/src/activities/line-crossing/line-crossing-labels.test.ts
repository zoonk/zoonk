import { describe, expect, it } from "vitest";
import { belongsWith, isOnNamedSide, touchesBox, touchesSegment } from "../_utils/drawing-label";
import {
  ARROW_HEAD,
  ARROW_STROKE,
  type LabelBox,
  changeArrowBoxes,
  changeArrows,
  placeChartLabels,
  placeLineLabels,
} from "./line-crossing-labels";
import { type Point } from "./line-crossing-model";

const area = { bottom: 222, left: 22, right: 311, top: 26 };
const size = { height: 12, width: 50 };
const noMarks = { boxes: [], circles: [], lines: [] };

const chartSegment = (x0: number, y0: number, x1: number, y1: number) => ({
  from: { x: x0, y: y0 },
  to: { x: x1, y: y1 },
});

function breakEvenPlot(costStart: number, costEnd: number, height: number, after: Point) {
  const plot = { bottom: 248, left: 0, right: 230, top: 0 };
  const cost = chartSegment(0, costStart, 230, costEnd);
  const revenue = chartSegment(0, 248, 230, 51 + 1 / 3);
  const original = chartSegment(0, 189, 230, 90 + 2 / 3);
  const before = { x: 138, y: 130 };

  const marks = {
    boxes: [
      { bottom: 14, left: 0, right: 60, top: 0 },
      ...changeArrowBoxes({ after, before, bottom: 248, left: 0 }),
    ],
    circles: [before, after].map(({ x, y }) => ({ cx: x, cy: y, radius: 5 })),
    lines: [before, after].flatMap(({ x, y }) => [
      chartSegment(0, y, x, y),
      chartSegment(x, y, x, 248),
    ]),
  };

  const widths = height === 12 ? [26, 46, 40] : [35, 62, 53];

  const shown = [cost, revenue, original].map((segment, index) => ({
    isOptional: index === 2,
    isUpper: index < 2,
    segment,
    size: { height, width: widths[index]! },
  }));

  return { marks, plot, shown };
}

function hasSampledPosition(
  plot: LabelBox,
  labelSize: { height: number; width: number },
  accepts: (box: LabelBox) => boolean,
): boolean {
  const step = 0.25;
  const maxTop = plot.bottom - labelSize.height;
  const maxLeft = plot.right - labelSize.width;

  for (let y = 0; y < maxTop + step; y += step) {
    for (let x = 0; x < maxLeft + step; x += step) {
      const top = Math.min(y, maxTop);
      const left = Math.min(x, maxLeft);

      if (accepts({ bottom: top + labelSize.height, left, right: left + labelSize.width, top })) {
        return true;
      }
    }
  }

  return false;
}

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

  it("keeps shown names in place when the answer line clears both", () => {
    const clearAnswer = { ...answer, segment: { from: { x: 22, y: 200 }, to: { x: 311, y: 200 } } };
    const before = placeChartLabels({ area, marks: noMarks, revealed: [], shown: [revenue, cost] });

    const after = placeChartLabels({
      area,
      marks: noMarks,
      revealed: [clearAnswer],
      shown: [revenue, cost],
    });

    expect(after.slice(0, 2)).toStrictEqual(before);
    expect(after[2]).not.toBeNull();
  });

  it("moves a crossed name to the closest clear spot and keeps the other name in place", () => {
    const shown = [
      { isUpper: true, segment: { from: { x: 22, y: 104 }, to: { x: 311, y: 100 } }, size },
      { isUpper: true, segment: { from: { x: 22, y: 170 }, to: { x: 311, y: 160 } }, size },
    ];

    const revealed = [{ ...answer, segment: { from: { x: 22, y: 86 }, to: { x: 311, y: 86 } } }];
    const before = placeChartLabels({ area, marks: noMarks, revealed: [], shown });
    const after = placeChartLabels({ area, marks: noMarks, revealed, shown });

    expect(before[0]).toStrictEqual({ bottom: 92, left: 253, right: 303, top: 80 });
    expect(after[0]).toStrictEqual({ bottom: 116, left: 253, right: 303, top: 104 });
    expect(after[1]).toStrictEqual(before[1]);
  });

  it("keeps an untouched name in place even when the answer is nearer", () => {
    const name = { isUpper: true, segment: chartSegment(22, 104, 311, 100), size };

    const revealed = [{ ...answer, segment: chartSegment(22, 75, 311, 75) }];
    const [before] = placeChartLabels({ area, marks: noMarks, revealed: [], shown: [name] });
    const [after] = placeChartLabels({ area, marks: noMarks, revealed, shown: [name] });

    expect(before && touchesSegment(before, revealed[0]!.segment)).toBe(false);

    expect(after).toStrictEqual(before);
  });

  it("keeps a name closer to its own line than a dotted guide", () => {
    const segment = { from: { x: 22, y: 104 }, to: { x: 311, y: 100 } };
    const guide = { from: { x: 22, y: 76 }, to: { x: 311, y: 76 } };
    const marks = { ...noMarks, lines: [guide] };

    const [box] = placeChartLabels({
      area,
      marks,
      revealed: [],
      shown: [{ isUpper: true, segment, size }],
    });

    expect(box && gapToSegment(box, segment)).toBeLessThan(box ? gapToSegment(box, guide) : 0);
  });

  it("keeps the crossed name on its line's side when a 320 px chart cannot fit it between the lines", () => {
    const primary = { from: { x: 0, y: 248 }, to: { x: 230, y: 141 } };
    const demand = { from: { x: 0, y: 50 }, to: { x: 214, y: 248 } };
    const original = { from: { x: 0, y: 229 }, to: { x: 230, y: 121 } };
    const correct = { from: { x: 0, y: 208 }, to: { x: 230, y: 101 } };

    const shown = [
      { isUpper: true, segment: primary, size: { height: 23, width: 55 } },
      { isUpper: true, segment: demand, size: { height: 23, width: 68 } },
      { isOptional: true, isUpper: false, segment: original, size: { height: 23, width: 55 } },
    ];

    const marks = {
      ...noMarks,
      lines: [
        { from: { x: 0, y: 182 }, to: { x: 140, y: 182 } },
        { from: { x: 140, y: 182 }, to: { x: 140, y: 248 } },
      ],
    };

    // The 320 px activity leaves 230 px for the plot at its largest chart text size.
    const plot = { bottom: 248, left: 0, right: 230, top: 0 };
    const before = placeChartLabels({ area: plot, marks, revealed: [], shown });

    const after = placeChartLabels({
      area: plot,
      marks,
      revealed: [{ isUpper: false, segment: correct, size: { height: 46, width: 82 } }],
      shown,
    });

    const box = after[2];

    if (!before[2] || !box) {
      throw new Error("The original line needs its name in both states.");
    }

    const answerY = 208 - (107 * ((box.left + box.right) / 2)) / 230;

    expect(after.slice(0, 2)).toStrictEqual(before.slice(0, 2));
    expect((box.top + box.bottom) / 2).toBeGreaterThan(answerY);
    expect(gapToSegment(box, correct)).toBeGreaterThanOrEqual(3);
    expect(gapToSegment(box, original)).toBeLessThan(40);
  });

  it("keeps a dragged line's name with it when a guide is in the way", () => {
    const supply = chartSegment(0, 227.33, 230, 20.67);
    const demand = chartSegment(0, 62, 207, 248);
    const original = chartSegment(0, 20.67, 230, 227.33);

    const shown = [supply, demand, original].map((line, index) => ({
      isOptional: index === 2,
      isUpper: index < 2,
      segment: line,
      size: { height: 16, width: 53 },
    }));

    const marks = {
      ...noMarks,
      circles: [
        { cx: 92, cy: 144.67, radius: 7 },
        { cx: 115, cy: 124, radius: 7 },
      ],
      lines: [
        chartSegment(0, 144.67, 115, 144.67),
        chartSegment(115, 144.67, 115, 248),
        chartSegment(0, 124, 115, 124),
        chartSegment(115, 124, 115, 248),
      ],
    };

    const [, name] = placeChartLabels({
      area: { bottom: 248, left: 0, right: 230, top: 0 },
      marks,
      revealed: [],
      shown,
    });

    expect(name && gapToSegment(name, demand)).toBeLessThan(
      name ? gapToSegment(name, original) : 0,
    );
  });

  it("keeps Cost nearer its own line than the crossing guides in a tight chart", () => {
    const { marks, plot, shown } = breakEvenPlot(169 + 1 / 3, 71, 12, { x: 184, y: 90 + 2 / 3 });
    const [name] = placeChartLabels({ area: plot, marks, revealed: [], shown });

    if (!name || !shown[0]) {
      throw new Error("Cost needs its name.");
    }

    expect(gapToSegment(name, shown[0].segment)).toBeLessThan(
      Math.min(...marks.lines.map((guide) => gapToSegment(name, guide))),
    );
  });

  it("uses a stroke-clear spot in the final search on a tight chart", () => {
    const { marks, plot, shown } = breakEvenPlot(169 + 1 / 3, 71, 12, { x: 184, y: 90 + 2 / 3 });
    const [costName] = placeChartLabels({ area: plot, marks, revealed: [], shown });

    if (!costName) {
      throw new Error("Cost needs its name.");
    }

    const strokes = [...shown.map((label) => label.segment), ...marks.lines];

    expect(strokes.filter((stroke) => touchesSegment(costName, stroke))).toStrictEqual([]);
    expect(marks.boxes.some((box) => touchesBox(costName, box))).toBe(false);
  });

  it("keeps Before from overlapping Cost after revealing the answer in a tight chart", () => {
    const { marks, plot, shown } = breakEvenPlot(248, 149 + 2 / 3, 16, { x: 0, y: 248 });
    const answerLine = chartSegment(0, 179 + 1 / 6, 230, 80 + 5 / 6);

    const names = placeChartLabels({
      area: plot,
      marks,
      revealed: [{ isUpper: false, segment: answerLine, size: { height: 16, width: 114 } }],
      shown,
    });

    const [costName, , original] = names;

    if (!costName || !original) {
      throw new Error("Cost and the dashed line both need names.");
    }

    const overlapWidth =
      Math.min(costName.right, original.right) - Math.max(costName.left, original.left);

    const overlapHeight =
      Math.min(costName.bottom, original.bottom) - Math.max(costName.top, original.top);

    expect(Math.min(overlapWidth, overlapHeight)).toBeLessThanOrEqual(0);
    expect(touchesSegment(original, answerLine)).toBe(false);
  });

  it("checks fractional plot-edge positions around names that stay put at Check", () => {
    const lines = [
      chartSegment(0, 206.6667, 330, 51.6667),
      chartSegment(38.8235, 0, 330, 155),
      chartSegment(0, 10.3333, 330, 186),
    ];

    const answerLine = chartSegment(0, 144.6667, 308, 0);
    const width = 158.7;
    const height = 23;
    const plot = { bottom: 248, left: 0, right: 330, top: 0 };

    const shown = lines.map((segment, index) => ({
      isOptional: index === 2,
      isUpper: index < 2,
      segment,
      size: { height, width: 75.9 },
    }));

    const before = placeChartLabels({ area: plot, marks: noMarks, revealed: [], shown });

    const checked = placeChartLabels({
      area: plot,
      marks: noMarks,
      revealed: [{ isUpper: false, segment: answerLine, size: { height, width } }],
      shown,
    });

    const [supplyName, demandName, beforeName, answerName] = checked;

    if (!supplyName || !demandName || !beforeName || !answerName) {
      throw new Error("The full chart needs all four names.");
    }

    expect(demandName).toStrictEqual(before[1]);
    expect(beforeName).toStrictEqual(before[2]);

    const names = [supplyName, demandName, beforeName, answerName];

    for (const [index, name] of names.entries()) {
      expect(touchesSegment(name, answerLine)).toBe(false);
      expect(names.slice(0, index).some((other) => touchesBox(name, other, 0))).toBe(false);
    }

    const edge = { bottom: height, left: 90.75, right: 90.75 + width, top: 0 };
    expect(belongsWith(edge, answerLine, lines)).toBe(true);
    expect(touchesSegment(edge, answerLine)).toBe(false);
    expect(touchesBox(edge, demandName, 0)).toBe(true);

    const occupied = [supplyName, demandName, beforeName];

    const available = hasSampledPosition(
      plot,
      { height, width },
      (box) =>
        !touchesSegment(box, answerLine) &&
        occupied.every((name) => !touchesBox(box, name, 0)) &&
        belongsWith(box, answerLine, lines),
    );

    expect(available).toBe(false);
  });

  it("keeps the moved line out from between Before and its dashed line at 390 px", () => {
    const supply = chartSegment(1, 218, 326, 134.8);
    const demand = chartSegment(1, 64.4, 301, 218);
    const original = chartSegment(1, 202.64, 326, 119.44);
    const correct = chartSegment(1, 187.28, 326, 104.08);

    const shown = [supply, demand, original].map((line, index) => ({
      isOptional: index === 2,
      isUpper: index < 2,
      segment: line,
      size: { height: 16, width: [40, 49, 38][index] ?? 38 },
    }));

    const marks = {
      boxes: [{ bottom: 20, left: 1, right: 106, top: 0 }],
      circles: [
        { cx: 109.75, cy: 190.16, radius: 15.25 },
        { cx: 256, cy: 194.96, radius: 15.25 },
        { cx: 201, cy: 166.8, radius: 6 },
        { cx: 181, cy: 156.56, radius: 6 },
      ],
      lines: [
        chartSegment(1, 166.8, 201, 166.8),
        chartSegment(201, 166.8, 201, 218),
        chartSegment(1, 156.56, 181, 156.56),
        chartSegment(181, 156.56, 181, 218),
      ],
    };

    const plot = { bottom: 218, left: 1, right: 326, top: 0 };
    const before = placeChartLabels({ area: plot, marks, revealed: [], shown })[2];

    const after = placeChartLabels({
      area: plot,
      marks,
      revealed: [{ isUpper: false, segment: correct, size: { height: 16, width: 89 } }],
      shown,
    })[2];

    expect(before && touchesSegment(before, correct)).toBe(true);
    expect(after && touchesSegment(after, correct)).toBe(false);
    expect(after && isOnNamedSide(after, original, supply)).toBe(true);

    expect(after && gapToSegment(after, original)).toBeLessThan(
      after ? gapToSegment(after, supply) : 0,
    );
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
