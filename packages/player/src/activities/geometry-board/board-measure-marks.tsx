"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useFormatNumber } from "../_utils/use-format-number";
import { type BoardMeasure, interiorAngles, sideSquares } from "./board-geometry";
import { cornerWedge } from "./board-marks";
import { type BoardReading } from "./board-measure";
import { type BoardScale } from "./board-scale";
import { BOARD_TONES, cornerTone, squareTone } from "./board-tones";

type Vector = { x: number; y: number };

const WEDGE_RADIUS = 26;
const MIN_WEDGE_RADIUS = 12;
const WEDGE_SHARE = 0.35;
const SIDE_LABEL_GAP = 14;
const HALO = "[paint-order:stroke] stroke-background stroke-[4px] [stroke-linejoin:round]";

export function polygonPath(pixels: readonly Vector[]): string {
  return `${pixels.map((pixel, index) => `${index === 0 ? "M" : "L"}${pixel.x.toFixed(2)} ${pixel.y.toFixed(2)}`).join(" ")} Z`;
}

export function centroid(pixels: readonly Vector[]): Vector {
  return {
    x: pixels.reduce((sum, pixel) => sum + pixel.x, 0) / pixels.length,
    y: pixels.reduce((sum, pixel) => sum + pixel.y, 0) / pixels.length,
  };
}

/** A point pushed away from the shape's middle, for labels that sit just outside it. */
export function awayFromMiddle(point: Vector, middle: Vector, distance: number): Vector {
  const length = Math.hypot(point.x - middle.x, point.y - middle.y) || 1;

  return {
    x: point.x + ((point.x - middle.x) / length) * distance,
    y: point.y + ((point.y - middle.y) / length) * distance,
  };
}

function around<T>(items: readonly T[], index: number): T | undefined {
  return items[(index + items.length) % items.length];
}

function BoardLabel({
  children,
  className,
  point,
}: {
  children: React.ReactNode;
  className?: string;
  point: Vector;
}) {
  return (
    <text
      className={cn("text-sm font-bold tabular-nums", HALO, className)}
      dominantBaseline="middle"
      textAnchor="middle"
      x={point.x}
      y={point.y}
    >
      {children}
    </text>
  );
}

function AngleWedges({
  ids,
  pixels,
  reading,
}: {
  ids: readonly string[];
  pixels: Vector[];
  reading: BoardReading;
}) {
  const format = useFormatNumber();
  const angles = interiorAngles(pixels);

  return pixels.map((corner, index) => {
    const [previous, next] = [around(pixels, index - 1), around(pixels, index + 1)];

    if (!previous || !next) {
      return null;
    }

    const shortest = Math.min(
      Math.hypot(previous.x - corner.x, previous.y - corner.y),
      Math.hypot(next.x - corner.x, next.y - corner.y),
    );

    const radius = Math.max(Math.min(WEDGE_RADIUS, shortest * WEDGE_SHARE), MIN_WEDGE_RADIUS);
    const wedge = cornerWedge({ angle: angles[index] ?? 0, corner, next, previous, radius });
    const tone = BOARD_TONES[cornerTone(index, pixels.length)];

    return (
      <g key={ids[index]}>
        <path className={tone.mark} d={wedge.path} strokeWidth={1.5} />
        <BoardLabel className={tone.text} point={wedge.label}>
          {format(reading.parts[index] ?? 0, { unit: "°" })}
        </BoardLabel>
      </g>
    );
  });
}

function SideSquares({
  hideTotal,
  ids,
  points,
  reading,
  scale,
}: {
  hideTotal: boolean;
  ids: readonly string[];
  points: Vector[];
  reading: BoardReading;
  scale: BoardScale;
}) {
  const format = useFormatNumber();

  return sideSquares(points).map((square, index) => {
    const tone = BOARD_TONES[squareTone({ index, totalIndex: reading.totalIndex })];
    const squarePixels = square.map((point) => scale.toPixel(point));
    const partAt = reading.partIndexes.indexOf(index);
    const isTotal = index === reading.totalIndex;
    const value = isTotal ? reading.total : (reading.parts[partAt] ?? 0);

    return (
      <g key={ids[index]}>
        <path className={tone.soft} d={polygonPath(squarePixels)} strokeWidth={1.5} />
        <BoardLabel className={tone.text} point={centroid(squarePixels)}>
          {isTotal && hideTotal ? "?" : format(value)}
        </BoardLabel>
      </g>
    );
  });
}

function SideLengths({
  ids,
  pixels,
  reading,
}: {
  ids: readonly string[];
  pixels: Vector[];
  reading: BoardReading;
}) {
  const format = useFormatNumber();
  const middle = centroid(pixels);

  return pixels.map((pixel, index) => {
    const next = around(pixels, index + 1) ?? pixel;
    const midpoint = { x: (pixel.x + next.x) / 2, y: (pixel.y + next.y) / 2 };

    return (
      <BoardLabel
        className="fill-foreground"
        key={ids[index]}
        point={awayFromMiddle(midpoint, middle, SIDE_LABEL_GAP)}
      >
        {format(reading.parts[index] ?? 0)}
      </BoardLabel>
    );
  });
}

/** The squares sit under the shape; everything else sits on it, under the corners. */
export function BoardMeasureUnderlay({
  hideTotal,
  ids,
  measure,
  pixels,
  points,
  reading,
  scale,
}: {
  hideTotal: boolean;
  ids: readonly string[];
  measure: BoardMeasure;
  pixels: Vector[];
  points: Vector[];
  reading: BoardReading;
  scale: BoardScale;
}) {
  if (measure === "pythagoras") {
    return (
      <g aria-hidden="true">
        <SideSquares
          hideTotal={hideTotal}
          ids={ids}
          points={points}
          reading={reading}
          scale={scale}
        />
      </g>
    );
  }

  return measure === "area" ? (
    <path aria-hidden="true" className="fill-viz-accent-soft" d={polygonPath(pixels)} />
  ) : null;
}

export function BoardMeasureOverlay({
  ids,
  measure,
  pixels,
  reading,
}: {
  ids: readonly string[];
  measure: BoardMeasure;
  pixels: Vector[];
  reading: BoardReading;
}) {
  if (measure === "angleSum") {
    return (
      <g aria-hidden="true">
        <AngleWedges ids={ids} pixels={pixels} reading={reading} />
      </g>
    );
  }

  return measure === "perimeter" ? (
    <g aria-hidden="true">
      <SideLengths ids={ids} pixels={pixels} reading={reading} />
    </g>
  ) : null;
}
