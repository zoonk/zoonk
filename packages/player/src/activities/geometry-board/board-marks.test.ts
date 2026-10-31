import { describe, expect, it } from "vitest";
import { cornerWedge, fanWedges } from "./board-marks";

function numbers(path: string): number[] {
  return (path.match(/-?\d+(?:\.\d+)?/gu) ?? []).map((value) => Number(value) + 0);
}

describe(cornerWedge, () => {
  it("draws a right angle's wedge inside the corner, with the label along its middle", () => {
    const wedge = cornerWedge({
      angle: 90,
      corner: { x: 0, y: 0 },
      next: { x: 10, y: 0 },
      previous: { x: 0, y: -10 },
      radius: 4,
    });

    expect(numbers(wedge.path)).toStrictEqual([0, 0, 4, 0, 4, 4, 0, 0, 0, 0, -4]);
    expect(wedge.label.x).toBeCloseTo(12.73, 1);
    expect(wedge.label.y).toBeCloseTo(-12.73, 1);
  });

  it("goes the long way round for a dent in the shape", () => {
    const wedge = cornerWedge({
      angle: 270,
      corner: { x: 0, y: 0 },
      next: { x: 10, y: 0 },
      previous: { x: 0, y: -10 },
      radius: 4,
    });

    expect(numbers(wedge.path)[8]).toBe(1);
    expect(wedge.label.x).toBeCloseTo(-12.73, 1);
    expect(wedge.label.y).toBeCloseTo(12.73, 1);
  });
});

describe(fanWedges, () => {
  it("lays the angles side by side from the left over the top", () => {
    const [first, second] = fanWedges({ angles: [90, 90], center: { x: 0, y: 0 }, radius: 10 });

    expect(numbers(first ?? "").slice(2, 4)).toStrictEqual([-10, 0]);
    expect(numbers(first ?? "").slice(-2)).toStrictEqual([0, -10]);
    expect(numbers(second ?? "").slice(-2)).toStrictEqual([10, 0]);
  });
});
