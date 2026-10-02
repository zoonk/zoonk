import { type BoardBounds } from "./board-geometry";

type Vector = { x: number; y: number };

export type BoardScale = {
  height: number;
  /** Pixels per unit, the same on both axes so shapes and angles look true. */
  unit: number;
  toData: (pixel: Vector) => Vector;
  toPixel: (point: Vector) => Vector;
};

/**
 * Fits the board into the measured width, capped in height, with one scale for both axes (a
 * right angle must look right) and y pointing up like on paper.
 */
export function createBoardScale({
  bounds,
  maxHeight,
  padding,
  width,
}: {
  bounds: BoardBounds;
  maxHeight: number;
  padding: number;
  width: number;
}): BoardScale {
  const spanX = Math.max(bounds.maxX - bounds.minX, Number.EPSILON);
  const spanY = Math.max(bounds.maxY - bounds.minY, Number.EPSILON);

  const unit = Math.max(
    Math.min((width - 2 * padding) / spanX, (maxHeight - 2 * padding) / spanY),
    1,
  );

  const left = (width - spanX * unit) / 2;

  return {
    height: spanY * unit + 2 * padding,
    toData: (pixel) => ({
      x: bounds.minX + (pixel.x - left) / unit,
      y: bounds.maxY - (pixel.y - padding) / unit,
    }),
    toPixel: (point) => ({
      x: left + (point.x - bounds.minX) * unit,
      y: padding + (bounds.maxY - point.y) * unit,
    }),
    unit,
  };
}
