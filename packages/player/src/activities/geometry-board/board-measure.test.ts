import { describe, expect, it } from "vitest";
import { readBoard } from "./board-measure";

const rightTriangle = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 0, y: 3 },
];

const slanted = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 1, y: 3 },
];

describe(readBoard, () => {
  it("shows whole-degree angles that add up to the angle sum", () => {
    const reading = readBoard(slanted, "angleSum");

    expect(reading.parts).toStrictEqual([72, 45, 63]);
    expect(reading.total).toBe(180);
  });

  it("puts the squares on the legs against the square on the longest side", () => {
    expect(readBoard(rightTriangle, "pythagoras")).toStrictEqual({
      partIndexes: [0, 2],
      parts: [16, 9],
      total: 25,
      totalIndex: 1,
    });
  });

  it("adds rounded side lengths into the perimeter and measures the area", () => {
    const perimeter = readBoard(slanted, "perimeter");

    expect(perimeter.parts).toStrictEqual([4, 4.2, 3.2]);
    expect(perimeter.total).toBe(11.4);
    expect(readBoard(slanted, "area")).toMatchObject({ parts: [], total: 6 });
  });
});
