import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { type PointShape, type SeriesMark } from "./_utils/series-marks";

const OPEN_STROKE = 1.5;
const OPEN_FILL = 0.2;
const OPEN_LINE_DASH = "5 4";
const BAR_RADIUS = 3;

/** Sized so every shape weighs about the same as the 3.5px dot. */
const POINT_SHAPES: Record<Exclude<PointShape, "cross">, string> = {
  circle: "M-3.5,0a3.5,3.5 0 1,0 7,0a3.5,3.5 0 1,0 -7,0Z",
  diamond: "M0,-4.5L4.5,0L0,4.5L-4.5,0Z",
  square: "M-3.1,-3.1H3.1V3.1H-3.1Z",
  triangle: "M0,-4.2L4.4,3.2H-4.4Z",
};

const CROSS = "M-3,-3L3,3M-3,3L3,-3";

export function SeriesBar({
  height,
  mark,
  width,
  x,
  y,
}: {
  height: number;
  mark: SeriesMark;
  width: number;
  x: number;
  y: number;
}) {
  const inset = mark.open ? Math.min(OPEN_STROKE, width, height) / 2 : 0;

  return (
    <rect
      className={cn("fill-current", mark.tone, mark.open && "stroke-current")}
      fillOpacity={mark.open ? OPEN_FILL : undefined}
      height={height - inset * 2}
      rx={BAR_RADIUS - inset}
      strokeWidth={mark.open ? inset * 2 : undefined}
      width={width - inset * 2}
      x={x + inset}
      y={y + inset}
    />
  );
}

export function SeriesLine({
  mark,
  points,
}: {
  mark: SeriesMark;
  points: { x: number; y: number }[];
}) {
  return (
    <polyline
      className={cn("fill-none stroke-current stroke-2", mark.tone)}
      points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      strokeDasharray={mark.open ? OPEN_LINE_DASH : undefined}
      strokeLinejoin="round"
    />
  );
}

export function SeriesPoint({ mark, x, y }: { mark: SeriesMark; x: number; y: number }) {
  const transform = `translate(${x} ${y})`;

  if (mark.shape === "cross") {
    return (
      <path
        className={cn("fill-none stroke-current stroke-2", mark.tone)}
        d={CROSS}
        strokeLinecap="round"
        transform={transform}
      />
    );
  }

  return (
    <path
      className={cn(mark.tone, mark.open ? "fill-card stroke-current" : "fill-current")}
      d={POINT_SHAPES[mark.shape]}
      strokeLinejoin="round"
      strokeWidth={mark.open ? OPEN_STROKE : undefined}
      transform={transform}
    />
  );
}

/** A legend's sample of its series, drawn as the plot draws it. */
export function SeriesSwatch({ chart, mark }: { chart: ChartVisual["chart"]; mark: SeriesMark }) {
  if (chart === "line") {
    return (
      <svg className="size-2.5 shrink-0 overflow-visible" viewBox="-5 -5 10 10">
        <SeriesPoint mark={mark} x={0} y={0} />
      </svg>
    );
  }

  return (
    <span
      className={cn(
        "size-2.5 shrink-0 rounded-sm",
        mark.tone,
        mark.open ? "border-[1.5px] border-current bg-current/20" : "bg-current",
      )}
    />
  );
}
