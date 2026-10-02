import { describe, expect, it } from "vitest";
import { BAG_HEIGHT, panLayout } from "./balance-layout";

const WIDTH = 144;

describe(panLayout, () => {
  it("puts bags in a row with blocks stacked beside them on the plate", () => {
    const layout = panLayout({ units: 7, x: 2 }, WIDTH);

    expect(layout.bags.map((bag) => bag.y)).toStrictEqual([BAG_HEIGHT, BAG_HEIGHT]);
    expect(Math.min(...layout.blocks.map((block) => block.x))).toBeGreaterThan(layout.bags[1]!.x);
    expect(layout.blocks).toHaveLength(7);
    expect(Math.max(...layout.blocks.map((block) => block.x))).toBeLessThanOrEqual(WIDTH);
  });

  it("wraps bags to a second row when they don't fit beside the blocks", () => {
    const layout = panLayout({ units: 1, x: 4 }, WIDTH);

    expect(new Set(layout.bags.map((bag) => bag.y)).size).toBe(2);
    expect(layout.height).toBe(BAG_HEIGHT * 2);
  });

  it("draws fractions and big amounts as one weight instead of blocks", () => {
    for (const units of [3.5, 40]) {
      const layout = panLayout({ units, x: 0 }, WIDTH);

      expect(layout.blocks).toStrictEqual([]);
      expect(layout.weight).toStrictEqual({ x: 0, y: 30 });
    }
  });

  it("is empty for an empty pan", () => {
    expect(panLayout({ units: 0, x: 0 }, WIDTH)).toStrictEqual({
      bags: [],
      blocks: [],
      height: 0,
      weight: null,
    });
  });
});
