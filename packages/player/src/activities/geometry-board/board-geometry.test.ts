import { describe, expect, it } from "vitest";
import {
  type BoardPoint,
  boardBounds,
  gridStep,
  interiorAngles,
  keyOffset,
  minimumArea,
  moveCorner,
  polygonArea,
  roundParts,
  sideLengths,
  sideSquares,
} from "./board-geometry";

const triangle: BoardPoint[] = [
  { id: "a", movable: true, x: 0, y: 0 },
  { id: "b", movable: false, x: 4, y: 0 },
  { id: "c", movable: true, x: 1, y: 3 },
];

const rightTriangle: BoardPoint[] = [
  { id: "a", movable: false, x: 0, y: 0 },
  { id: "b", movable: true, track: "horizontal", x: 4, y: 0 },
  { id: "c", movable: true, track: "vertical", x: 0, y: 3 },
];

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe(interiorAngles, () => {
  it("adds up to 180° in a triangle and 360° in a quadrilateral, either way round", () => {
    expect(sum(interiorAngles(triangle))).toBeCloseTo(180);
    expect(sum(interiorAngles(triangle.toReversed()))).toBeCloseTo(180);

    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];

    expect(interiorAngles(square)).toStrictEqual([90, 90, 90, 90]);
  });

  it("measures a dent in a shape as more than 180°", () => {
    const arrow = [
      { x: 0, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 4 },
      { x: 1, y: 2 },
    ];

    const angles = interiorAngles(arrow);

    expect(angles[3]).toBeGreaterThan(180);
    expect(sum(angles)).toBeCloseTo(360);
  });
});

describe(roundParts, () => {
  it("keeps rounded parts adding up to the rounded total", () => {
    expect(sum(roundParts([60.4, 60.4, 59.2], 0))).toBe(180);
    expect(roundParts([45, 71.565, 63.435], 0)).toStrictEqual([45, 72, 63]);
    expect(sum(roundParts([2.34, 4.2, 5.83], 1))).toBeCloseTo(12.4);
  });
});

describe(sideSquares, () => {
  it("stands each square outward on its side, however the corners wind", () => {
    const [bottom] = sideSquares(rightTriangle);
    const reversedLeft = sideSquares(rightTriangle.toReversed())[2];

    expect(bottom?.map((point) => point.y).every((y) => y <= 0)).toBe(true);
    expect(reversedLeft?.map((point) => point.x).every((x) => x <= 0)).toBe(true);
  });

  it("gives squares whose areas follow a² + b² = c² on a right triangle", () => {
    const areas = sideSquares(rightTriangle).map((square) => polygonArea(square));

    expect(areas.toSorted((first, second) => first - second)).toStrictEqual([9, 16, 25]);
  });
});

describe(gridStep, () => {
  it("picks the largest round step every corner sits on", () => {
    expect(gridStep(triangle)).toBe(1);

    expect(
      gridStep([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 10, y: 30 },
      ]),
    ).toBe(10);

    expect(
      gridStep([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 0.5, y: 1.5 },
      ]),
    ).toBe(0.5);
  });
});

describe(moveCorner, () => {
  const step = 1;
  const bounds = boardBounds({ measure: "angleSum", points: triangle, step });
  const minArea = minimumArea(triangle);
  const base = { bounds, measure: "angleSum" as const, minArea, points: triangle, step };

  it("snaps a free corner to the grid", () => {
    expect(moveCorner({ ...base, index: 2, to: { x: 2.3, y: 3.6 } })?.[2]).toMatchObject({
      x: 2,
      y: 4,
    });
  });

  it("keeps fixed corners in place and refuses shapes that flatten", () => {
    expect(moveCorner({ ...base, index: 1, to: { x: 5, y: 1 } })).toBeNull();
    expect(moveCorner({ ...base, index: 2, to: { x: 2, y: 0 } })).toBeNull();
  });

  it("stops a corner dragged off the board at its edge", () => {
    expect(moveCorner({ ...base, index: 2, to: { x: 1, y: 50 } })?.[2]).toMatchObject({
      y: bounds.maxY,
    });
  });

  it("slides a corner on a track only along it", () => {
    const rightBounds = boardBounds({ measure: "pythagoras", points: rightTriangle, step });

    const moved = moveCorner({
      ...base,
      bounds: rightBounds,
      index: 1,
      measure: "pythagoras",
      minArea: minimumArea(rightTriangle),
      points: rightTriangle,
      to: { x: 5, y: 2 },
    });

    expect(moved?.[1]).toMatchObject({ x: 5, y: 0 });
  });
});

describe(moveCorner, () => {
  it("refuses a move that makes a quadrilateral's sides cross", () => {
    const square: BoardPoint[] = [
      { id: "a", movable: false, x: 0, y: 0 },
      { id: "b", movable: true, x: 4, y: 0 },
      { id: "c", movable: false, x: 4, y: 4 },
      { id: "d", movable: false, x: 0, y: 4 },
    ];

    const bounds = { maxX: 10, maxY: 10, minX: -10, minY: -10 };
    const base = { bounds, index: 1, measure: "angleSum" as const, minArea: 0, points: square };

    expect(moveCorner({ ...base, step: 1, to: { x: 5, y: 1 } })).not.toBeNull();
    expect(moveCorner({ ...base, step: 1, to: { x: 2, y: 6 } })).toBeNull();
  });
});

describe(sideLengths, () => {
  it("measures each side from its corner to the next", () => {
    expect(sideLengths(rightTriangle)).toStrictEqual([4, 5, 3]);
  });
});

describe(keyOffset, () => {
  it("moves a free corner with each arrow and a tracked corner with any arrow along its track", () => {
    expect(keyOffset({ key: "ArrowUp", step: 1, track: undefined })).toStrictEqual({ x: 0, y: 1 });

    expect(keyOffset({ key: "ArrowUp", step: 1, track: "horizontal" })).toStrictEqual({
      x: 1,
      y: 0,
    });

    expect(keyOffset({ key: "ArrowLeft", step: 2, track: "vertical" })).toStrictEqual({
      x: 0,
      y: -2,
    });

    expect(keyOffset({ key: "Enter", step: 1, track: undefined })).toBeNull();
  });
});
