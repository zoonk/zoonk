import { describe, expect, it } from "vitest";
import { jumpArc, jumpStops, numberLineTicks } from "./number-line-geometry";

/** The arrowhead's two wing tips, averaged: where it points back from. */
function wings(head: string) {
  const numbers = head.match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
  const [first, second] = [numbers.slice(0, 2), numbers.slice(4, 6)];

  return {
    x: ((first[0] ?? 0) + (second[0] ?? 0)) / 2,
    y: Math.max(first[1] ?? 0, second[1] ?? 0),
  };
}

describe(jumpStops, () => {
  it("lists the start and where each jump lands", () => {
    expect(jumpStops(-3, [{ by: 3 }, { by: 5 }])).toStrictEqual([-3, 0, 5]);
    expect(jumpStops(4, [{ by: -6 }])).toStrictEqual([4, -2]);
  });
});

describe(jumpArc, () => {
  it("arcs above the line from one point to the other, higher for longer jumps", () => {
    const short = jumpArc({ baseline: 100, from: 40, to: 80 });
    const long = jumpArc({ baseline: 100, from: 40, to: 200 });

    expect(short.path).toBe("M40 100 Q60 64 80 100");
    expect(short.labelX).toBe(60);
    expect(long.labelY).toBeLessThan(short.labelY);
  });

  it("points the arrowhead back along the arc from where it lands", () => {
    const rightward = jumpArc({ baseline: 100, from: 0, to: 100 });
    const leftward = jumpArc({ baseline: 100, from: 100, to: 0 });

    expect(rightward.head).toContain("L100 100");
    expect(wings(rightward.head).x).toBeLessThan(100);
    expect(leftward.head).toContain("L0 100");
    expect(wings(leftward.head).x).toBeGreaterThan(0);
    expect(wings(leftward.head).y).toBeLessThan(100);
  });
});

describe(numberLineTicks, () => {
  it("marks every step and labels them all on short lines", () => {
    const ticks = numberLineTicks({ max: 2, min: -2, step: 1 });

    expect(ticks.map((tick) => tick.value)).toStrictEqual([-2, -1, 0, 1, 2]);
    expect(ticks.every((tick) => tick.isLabelled)).toBe(true);
  });

  it("labels every other tick on long lines but always labels zero", () => {
    const ticks = numberLineTicks({ max: 9, min: -10, step: 1 });

    expect(ticks.filter((tick) => tick.isLabelled).map((tick) => tick.value)).toContain(0);
    expect(ticks.find((tick) => tick.value === -9)?.isLabelled).toBe(false);
  });

  it("keeps decimal steps free of float noise", () => {
    expect(
      numberLineTicks({ max: 0.3, min: 0, step: 0.1 }).map((tick) => tick.value),
    ).toStrictEqual([0, 0.1, 0.2, 0.3]);
  });
});
