import { array, assert, constantFrom, integer, property, record } from "fast-check";
import { describe, expect, it } from "vitest";
import { distributionTailBottom } from "./distribution-tail-label";

const plot = { bottom: 100, left: 0, right: 100, top: 0 };

const clear = {
  anchor: "start" as const,
  at: 40,
  curve: [
    { x: 0, y: 50 },
    { x: 100, y: 50 },
  ],
  obstacles: [],
  plot,
  preferred: 30,
  size: { height: 10, width: 20 },
};

describe(distributionTailBottom, () => {
  it("takes the first safe position above the curve", () => {
    expect(distributionTailBottom(clear)).toBe(30);
  });

  it("uses the original baseline position when the first position hits the target", () => {
    expect(
      distributionTailBottom({
        ...clear,
        obstacles: [{ bottom: 35, left: 35, right: 65, top: 15 }],
      }),
    ).toBe(86);
  });

  it("uses the baseline position when the first box leaves the plot", () => {
    expect(distributionTailBottom({ ...clear, preferred: 5 })).toBe(86);
  });

  it("hides a label when the curve crosses both candidate boxes", () => {
    expect(
      distributionTailBottom({
        ...clear,
        curve: [
          { x: 50, y: 0 },
          { x: 50, y: 100 },
        ],
      }),
    ).toBeUndefined();
  });

  it("hides a label whose box cannot fit horizontally", () => {
    expect(distributionTailBottom({ ...clear, anchor: "end", at: 10 })).toBeUndefined();
  });

  it("every chosen box stays inside the plot and clear of other labels", () => {
    const rectangleInput = record({
      height: integer({ max: 60, min: 1 }),
      left: integer({ max: 120, min: -20 }),
      top: integer({ max: 120, min: -20 }),
      width: integer({ max: 80, min: 1 }),
    });

    assert(
      property(
        record({
          anchor: constantFrom("start" as const, "end" as const),
          at: integer({ max: 120, min: -20 }),
          preferred: integer({ max: 130, min: -20 }),
          size: record({
            height: integer({ max: 60, min: 1 }),
            width: integer({ max: 80, min: 1 }),
          }),
        }),
        array(rectangleInput, { maxLength: 8 }),
        array(record({ x: integer({ max: 100, min: 0 }), y: integer({ max: 100, min: 0 }) }), {
          maxLength: 8,
        }),
        (input, rectangles, curve) => {
          const obstacles = rectangles.map((rectangle) => ({
            bottom: rectangle.top + rectangle.height,
            left: rectangle.left,
            right: rectangle.left + rectangle.width,
            top: rectangle.top,
          }));

          const bottom = distributionTailBottom({ ...input, curve, obstacles, plot });

          if (bottom === undefined) {
            return;
          }

          const left = input.anchor === "start" ? input.at : input.at - input.size.width;
          const right = left + input.size.width;
          const top = bottom - input.size.height;
          expect(left).toBeGreaterThanOrEqual(3);
          expect(right).toBeLessThanOrEqual(97);
          expect(top).toBeGreaterThanOrEqual(3);
          expect(bottom).toBeLessThanOrEqual(97);

          for (const obstacle of obstacles) {
            expect(
              Math.max(
                left - obstacle.right,
                obstacle.left - right,
                top - obstacle.bottom,
                obstacle.top - bottom,
              ),
            ).toBeGreaterThanOrEqual(3);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});
