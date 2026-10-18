import {
  type BoardMeasure,
  interiorAngles,
  polygonArea,
  roundParts,
  sideLengths,
} from "./board-geometry";

type Vector = { x: number; y: number };

/** Digits each measure is shown with: whole degrees, lengths to a tenth, areas to a hundredth. */
const DIGITS: Record<BoardMeasure, number> = { angleSum: 0, area: 2, perimeter: 1, pythagoras: 2 };

export type BoardReading = {
  /** What adds up: each corner's angle, each side's length, or the squares on the two legs. */
  parts: number[];
  /** The side each part belongs to (for lengths and squares) or the corner (for angles). */
  partIndexes: number[];
  total: number;
  /** For Pythagoras, the side whose square is the total. */
  totalIndex: number | null;
};

function longestSide(points: readonly Vector[]): number {
  const lengths = sideLengths(points);
  return lengths.indexOf(Math.max(...lengths));
}

/**
 * What the board shows for its shape right now, rounded so the parts on screen add up exactly to
 * the total on screen.
 */
export function readBoard(points: readonly Vector[], measure: BoardMeasure): BoardReading {
  const digits = DIGITS[measure];
  const indexes = points.map((_, index) => index);

  if (measure === "angleSum") {
    const parts = roundParts(interiorAngles(points), digits);
    return { partIndexes: indexes, parts, total: sum(parts), totalIndex: null };
  }

  if (measure === "perimeter") {
    const parts = roundParts(sideLengths(points), digits);
    return { partIndexes: indexes, parts, total: sum(parts), totalIndex: null };
  }

  if (measure === "area") {
    const [total = 0] = roundParts([polygonArea(points)], digits);
    return { partIndexes: [], parts: [], total, totalIndex: null };
  }

  const hypotenuse = longestSide(points);
  const squares = sideLengths(points).map((length) => length ** 2);
  const legs = indexes.filter((index) => index !== hypotenuse);

  const parts = roundParts(
    legs.map((index) => squares[index] ?? 0),
    digits,
  );

  const [total = 0] = roundParts([squares[hypotenuse] ?? 0], digits);

  return { partIndexes: legs, parts, total, totalIndex: hypotenuse };
}

function sum(values: readonly number[]): number {
  return Number(values.reduce((total, value) => total + value, 0).toPrecision(12));
}
