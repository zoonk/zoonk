import { describe, expect, it } from "vitest";
import { createBoardScale } from "./board-scale";

describe(createBoardScale, () => {
  const bounds = { maxX: 4, maxY: 2, minX: 0, minY: 0 };

  it("uses one scale for both axes, centered, with y pointing up", () => {
    const scale = createBoardScale({ bounds, maxHeight: 400, padding: 10, width: 220 });

    expect(scale.unit).toBe(50);
    expect(scale.height).toBe(120);
    expect(scale.toPixel({ x: 0, y: 0 })).toStrictEqual({ x: 10, y: 110 });
    expect(scale.toPixel({ x: 4, y: 2 })).toStrictEqual({ x: 210, y: 10 });
  });

  it("shrinks to fit a tall board and turns pixels back into board points", () => {
    const scale = createBoardScale({
      bounds: { maxX: 1, maxY: 10, minX: 0, minY: 0 },
      maxHeight: 220,
      padding: 10,
      width: 300,
    });

    expect(scale.unit).toBe(20);
    expect(scale.toData(scale.toPixel({ x: 0.5, y: 7 }))).toStrictEqual({ x: 0.5, y: 7 });
  });
});
