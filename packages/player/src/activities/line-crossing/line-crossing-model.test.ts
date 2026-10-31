import { lineCrossingTemplate } from "@zoonk/core/library/activities/line-crossing";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import {
  type Point,
  changeDirection,
  chartDomain,
  crossingPoint,
  lineShiftAnswer,
  lineSlide,
  moveLine,
  movedLine,
  shiftAxis,
  visibleSegment,
} from "./line-crossing-model";

const supply = { intercept: 1, slope: 0.5 };
const demand = { intercept: 10, slope: -1 };
const cost = { intercept: 2000, slope: 5 };
const revenue = { intercept: 0, slope: 15 };

const SMALLEST_PLOT = 192;
const HANDLE_REACH = 14 + 2.5 / 2;
const CROSSING_REACH = 7;
const { breakEven } = engineModeFixtures.lineCrossing;
const supplyDemand = activityContentFixtures.lineCrossing.fields;

const CHARTS = [
  { fields: supplyDemand, name: "supply and demand" },
  { fields: breakEven.fields, name: "break-even" },
  {
    fields: {
      ...breakEven.fields,
      lines: [
        { id: "cost", intercept: 500, label: "Cost", slope: 0 },
        { id: "revenue", intercept: 0, label: "Revenue", slope: 15 },
      ],
    },
    name: "flat cost",
  },
  {
    fields: { ...supplyDemand, shift: { amount: 2, direction: "down", line: "supply" } },
    name: "supply moved down",
  },
  {
    fields: { ...supplyDemand, shift: { amount: 2, direction: "down", line: "demand" } },
    name: "demand moved down",
  },
].map(({ fields, name }) => ({ fields: lineCrossingTemplate.fields.parse(fields), name }));

function onTheSmallestPlot(point: Point, domain: Point): Point {
  return { x: (point.x / domain.x) * SMALLEST_PLOT, y: (point.y / domain.y) * SMALLEST_PLOT };
}

function isOnTheSmallestPlot(point: Point, domain: Point): boolean {
  const { x, y } = onTheSmallestPlot(point, domain);
  return [x, y].every((side) => side >= HANDLE_REACH && side <= SMALLEST_PLOT - HANDLE_REACH);
}

function gapOnTheSmallestPlot(point: Point, other: Point, domain: Point): number {
  const [first, second] = [onTheSmallestPlot(point, domain), onTheSmallestPlot(other, domain)];
  return Math.hypot(first.x - second.x, first.y - second.y);
}

describe(movedLine, () => {
  it("moves a line right by giving every y more x", () => {
    const moved = movedLine(supply, -2, "horizontal");

    expect(moved).toStrictEqual({ intercept: 2, slope: 0.5 });
    expect(crossingPoint(moved, demand).x).toBeCloseTo(16 / 3);
    expect(crossingPoint(moved, demand).y).toBeCloseTo(14 / 3);
  });

  it("moves a line up by adding to every y", () => {
    const higher = movedLine(cost, 500, "vertical");

    expect(higher).toStrictEqual({ intercept: 2500, slope: 5 });
    expect(crossingPoint(higher, revenue)).toStrictEqual({ x: 250, y: 3750 });
  });
});

describe(crossingPoint, () => {
  it("finds where the lines cross", () => {
    expect(crossingPoint(supply, demand)).toStrictEqual({ x: 6, y: 4 });
  });

  it("raises y and lowers x when an upward line moves left", () => {
    const after = crossingPoint(movedLine(supply, -2, "horizontal"), demand);

    expect(after.y).toBeGreaterThan(4);
    expect(after.x).toBeLessThan(6);
  });
});

describe(lineShiftAnswer, () => {
  it("names the moved line and its direction along the shift's axis", () => {
    expect(lineShiftAnswer(moveLine("supply", -1), "horizontal")).toStrictEqual({
      curve: "supply",
      direction: "left",
      kind: "curveShift",
    });

    expect(lineShiftAnswer(moveLine("cost", 100), "vertical")).toStrictEqual({
      curve: "cost",
      direction: "up",
      kind: "curveShift",
    });
  });

  it("has no answer before anything moves", () => {
    expect(lineShiftAnswer({}, "horizontal")).toBeNull();
    expect(lineShiftAnswer({ demand: 0, supply: 0 }, "horizontal")).toBeNull();
  });
});

describe(chartDomain, () => {
  it("fits every crossing the learner can reach", () => {
    const domain = chartDomain({ amount: 2, axis: "horizontal", lines: [supply, demand] });
    const farthest = crossingPoint(supply, movedLine(demand, 4, "horizontal"));

    expect(domain.x).toBeGreaterThan(farthest.x);
    expect(domain.y).toBeGreaterThan(farthest.y);
  });

  it("fits a line moved up as far as it goes", () => {
    const domain = chartDomain({ amount: 500, axis: "vertical", lines: [cost, revenue] });
    const farthest = crossingPoint(movedLine(cost, 1000, "vertical"), revenue);

    expect(domain.x).toBeGreaterThan(farthest.x);
    expect(domain.y).toBeGreaterThan(farthest.y);
  });
});

describe(lineSlide, () => {
  it("keeps every handle on the chart, off the crossing at rest, and the right move in reach", () => {
    const problems = CHARTS.flatMap(({ fields, name }) => {
      const { amount, direction } = fields.shift;
      const axis = shiftAxis(direction);
      const [first, second] = fields.lines;

      if (!first || !second) {
        return [`${name} has no two lines`];
      }

      const domain = chartDomain({ amount, axis, lines: [first, second] });
      const crossing = crossingPoint(first, second);
      const real = direction === "right" || direction === "up" ? amount : -amount;

      return fields.lines.flatMap((line) => {
        const { at, offsets } = lineSlide({ amount, axis, crossing, domain, line });
        const where = (offset: number) => `${name}: ${line.label} at ${offset}`;

        return [
          ...offsets
            .filter((offset) => !isOnTheSmallestPlot(at(offset), domain))
            .map((offset) => `${where(offset)} leaves the chart at ${JSON.stringify(at(offset))}`),
          ...(gapOnTheSmallestPlot(at(0), crossing, domain) < HANDLE_REACH + CROSSING_REACH
            ? [`${where(0)} covers the crossing`]
            : []),
          ...(line.id === fields.shift.line && !offsets.includes(real)
            ? [`${where(real)} is out of reach`]
            : []),
        ];
      });
    });

    expect(problems).toStrictEqual([]);
  });
});

describe(visibleSegment, () => {
  it("keeps a line inside the chart, and draws a flat line across it", () => {
    expect(visibleSegment(demand, { x: 20, y: 20 })).toStrictEqual({
      from: { x: 0, y: 10 },
      to: { x: 10, y: 0 },
    });

    expect(visibleSegment({ intercept: 3, slope: 0 }, { x: 8, y: 5 })).toStrictEqual({
      from: { x: 0, y: 3 },
      to: { x: 8, y: 3 },
    });
  });
});

describe(changeDirection, () => {
  it("tells up, down and no change apart", () => {
    expect(changeDirection(4, 5)).toBe("up");
    expect(changeDirection(4, 3)).toBe("down");
    expect(changeDirection(4, 4 + 1e-12)).toBe("same");
  });
});
