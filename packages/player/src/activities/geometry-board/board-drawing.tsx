"use client";

import { BoardCorner, BoardFixedCorner } from "./board-corner";
import { type BoardBounds, type BoardMeasure, type BoardPoint, hasMoved } from "./board-geometry";
import { type BoardReading } from "./board-measure";
import {
  BoardMeasureOverlay,
  BoardMeasureUnderlay,
  awayFromMiddle,
  centroid,
  polygonPath,
} from "./board-measure-marks";
import { type BoardScale } from "./board-scale";

type Vector = { x: number; y: number };

/** Past this many lines the grid thins out, so it stays a quiet background on a phone. */
const MAX_GRID_LINES = 24;
/** Corner names sit outside the 44px handle around each corner. */
const LABEL_GAP = 30;

function gridValues(from: number, to: number, step: number): number[] {
  const count = Math.round((to - from) / step);
  const every = Math.ceil((count + 1) / MAX_GRID_LINES);

  return Array.from({ length: count + 1 }, (_, index) => from + index * step).filter(
    (_, index) => index % every === 0,
  );
}

function BoardGrid({
  bounds,
  scale,
  step,
}: {
  bounds: BoardBounds;
  scale: BoardScale;
  step: number;
}) {
  const [topLeft, bottomRight] = [
    scale.toPixel({ x: bounds.minX, y: bounds.maxY }),
    scale.toPixel({ x: bounds.maxX, y: bounds.minY }),
  ];

  const columns = gridValues(bounds.minX, bounds.maxX, step).map(
    (x) => scale.toPixel({ x, y: 0 }).x,
  );

  const rows = gridValues(bounds.minY, bounds.maxY, step).map((y) => scale.toPixel({ x: 0, y }).y);

  return (
    <path
      aria-hidden="true"
      className="stroke-border"
      d={[
        ...columns.map((x) => `M${x.toFixed(2)} ${topLeft.y} V${bottomRight.y}`),
        ...rows.map((y) => `M${topLeft.x} ${y.toFixed(2)} H${bottomRight.x}`),
      ].join(" ")}
      strokeWidth={1}
    />
  );
}

/** The line a tracked corner slides on, across the whole board. */
function BoardTrack({
  bounds,
  point,
  scale,
}: {
  bounds: BoardBounds;
  point: BoardPoint;
  scale: BoardScale;
}) {
  const [from, to] =
    point.track === "horizontal"
      ? [
          scale.toPixel({ x: bounds.minX, y: point.y }),
          scale.toPixel({ x: bounds.maxX, y: point.y }),
        ]
      : [
          scale.toPixel({ x: point.x, y: bounds.minY }),
          scale.toPixel({ x: point.x, y: bounds.maxY }),
        ];

  return (
    <path
      aria-hidden="true"
      className="stroke-muted-foreground/60"
      d={`M${from.x} ${from.y} L${to.x} ${to.y}`}
      strokeDasharray="4 5"
      strokeWidth={1.5}
    />
  );
}

/**
 * The board: a grid, the shape with what it measures drawn on it (angles, lengths, squares or
 * its area), where it started as a dashed outline once moved, and the corners.
 */
export function BoardDrawing({
  bounds,
  cornerLabel,
  cornerValueText,
  descriptionId,
  disabled,
  hideTotal,
  measure,
  onMoveBy,
  onMoveTo,
  points,
  reading,
  scale,
  start,
  step,
  width,
}: {
  bounds: BoardBounds;
  cornerLabel: (index: number) => string;
  cornerValueText: (point: BoardPoint) => string;
  descriptionId: string;
  disabled: boolean;
  hideTotal: boolean;
  measure: BoardMeasure;
  onMoveBy: (index: number, offset: Vector) => void;
  onMoveTo: (index: number, point: Vector) => void;
  points: BoardPoint[];
  reading: BoardReading;
  scale: BoardScale;
  start: BoardPoint[];
  step: number;
  width: number;
}) {
  const pixels = points.map((point) => scale.toPixel(point));
  const ids = points.map((point) => point.id);
  const middle = centroid(pixels);

  return (
    <svg
      className="block overflow-visible text-xs"
      height={scale.height}
      viewBox={`0 0 ${width} ${scale.height}`}
      width={width}
    >
      <BoardGrid bounds={bounds} scale={scale} step={step} />

      {points
        .filter((point) => point.movable && point.track && !disabled)
        .map((point) => (
          <BoardTrack bounds={bounds} key={point.id} point={point} scale={scale} />
        ))}

      <BoardMeasureUnderlay
        hideTotal={hideTotal}
        ids={ids}
        measure={measure}
        pixels={pixels}
        points={points}
        reading={reading}
        scale={scale}
      />

      {hasMoved(points, start) && (
        <path
          aria-hidden="true"
          className="stroke-muted-foreground/70 fill-none"
          d={polygonPath(start.map((point) => scale.toPixel(point)))}
          strokeDasharray="4 4"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      )}

      <path
        aria-hidden="true"
        className="fill-foreground/3 stroke-foreground"
        d={polygonPath(pixels)}
        strokeLinejoin="round"
        strokeWidth={2}
      />

      <BoardMeasureOverlay ids={ids} measure={measure} pixels={pixels} reading={reading} />

      {points.map((point, index) => {
        const pixel = pixels[index] ?? middle;

        return (
          <g key={point.id}>
            {point.label && (
              <text
                aria-hidden="true"
                className="fill-foreground stroke-background stroke-[4px] text-sm font-semibold [paint-order:stroke] [stroke-linejoin:round]"
                dominantBaseline="middle"
                textAnchor="middle"
                x={awayFromMiddle(pixel, middle, LABEL_GAP).x}
                y={awayFromMiddle(pixel, middle, LABEL_GAP).y}
              >
                {point.label}
              </text>
            )}

            {point.movable ? (
              <BoardCorner
                bounds={bounds}
                descriptionId={descriptionId}
                disabled={disabled}
                label={cornerLabel(index)}
                onMoveBy={(offset) => onMoveBy(index, offset)}
                onMoveTo={(to) => onMoveTo(index, to)}
                pixel={pixel}
                point={point}
                scale={scale}
                step={step}
                valueText={cornerValueText(point)}
              />
            ) : (
              <BoardFixedCorner pixel={pixel} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
