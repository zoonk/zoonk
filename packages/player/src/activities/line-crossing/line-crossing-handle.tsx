"use client";

import { type LinearScale, createLinearScale } from "@zoonk/utils/plot-scale";
import { ActivityPlaceHandle } from "../_components/activity-place-handle";
import { usePlotScales } from "../_components/activity-plot";
import { CROSSING_RADIUS } from "./line-crossing-marks";
import {
  type Line,
  type Point,
  type ShiftAxis,
  pointAlong,
  slideRange,
} from "./line-crossing-model";

export const HANDLE_RADIUS = 14;
export const HANDLE_STROKE = 2.5;
const CHEVRON = 4;
const HANDLE_SHARE = 0.82;
const HANDLE_SHARE_STEPS = 100;
const CROSSING_CLEARANCE = 3;

const HANDLE_SHARES = Array.from(
  { length: HANDLE_SHARE_STEPS + 1 },
  (_, step) => step / HANDLE_SHARE_STEPS,
).toSorted((first, second) => Math.abs(first - HANDLE_SHARE) - Math.abs(second - HANDLE_SHARE));

type SlideRange = { max: number; min: number; step: number };

function chevrons({ axis, cx, cy }: { axis: ShiftAxis; cx: number; cy: number }): string {
  return axis === "horizontal"
    ? `M${cx - 2} ${cy - CHEVRON} l-${CHEVRON} ${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx + 2} ${cy - CHEVRON} l${CHEVRON} ${CHEVRON} l-${CHEVRON} ${CHEVRON}`
    : `M${cx - CHEVRON} ${cy - 2} l${CHEVRON} -${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx - CHEVRON} ${cy + 2} l${CHEVRON} ${CHEVRON} l${CHEVRON} -${CHEVRON}`;
}

/**
 * Where a line's handle rests and how far it slides: 82% along the line, past the crossings, or
 * the nearest point to that clear of the resting crossing, sliding as far as `slideRange` allows
 * with the whole handle on the chart.
 */
export function handleSlide({
  amount,
  axis,
  crossing,
  domain,
  line,
  real,
  scales,
}: {
  amount: number;
  axis: ShiftAxis;
  crossing: Point;
  domain: Point;
  line: Line;
  real: number;
  scales: { x: LinearScale; y: LinearScale };
}): { home: Point; range: SlideRange } {
  const clearance = HANDLE_RADIUS + HANDLE_STROKE / 2 + CROSSING_RADIUS + CROSSING_CLEARANCE;

  const isClear = (point: Point) =>
    Math.hypot(
      scales.x.toPixel(point.x) - scales.x.toPixel(crossing.x),
      scales.y.toPixel(point.y) - scales.y.toPixel(crossing.y),
    ) >= clearance;

  const share = HANDLE_SHARES.find((candidate) => isClear(pointAlong(line, domain, candidate)));
  const home = pointAlong(line, domain, share ?? HANDLE_SHARE);
  const [along, start] = axis === "horizontal" ? [scales.x, home.x] : [scales.y, home.y];
  const [first, last] = along.range;
  const inset = Math.sign(last - first) * (HANDLE_RADIUS + HANDLE_STROKE / 2);
  const ends = [along.toValue(first + inset), along.toValue(last - inset)];

  return {
    home,
    range: slideRange({
      amount,
      highest: Math.max(...ends),
      home: start,
      lowest: Math.min(...ends),
      real,
    }),
  };
}

export function handlePlace({
  axis,
  home,
  offset,
  range,
  scales,
}: {
  axis: ShiftAxis;
  home: Point;
  offset: number;
  range: SlideRange;
  scales: { x: LinearScale; y: LinearScale };
}) {
  const isSideways = axis === "horizontal";
  const along = isSideways ? scales.x : scales.y;
  const start = isSideways ? home.x : home.y;

  const scale = createLinearScale({
    domain: [range.min, range.max],
    range: [along.toPixel(start + range.min), along.toPixel(start + range.max)],
  });

  const [cx, cy] = isSideways
    ? [scale.toPixel(offset), scales.y.toPixel(home.y)]
    : [scales.x.toPixel(home.x), scale.toPixel(offset)];

  return { cx, cy, scale };
}

export function LineHandle({
  axis,
  className,
  disabled,
  home,
  label,
  offset,
  onChange,
  range,
  valueText,
}: {
  axis: ShiftAxis;
  className: string;
  disabled: boolean;
  home: Point;
  label: string;
  offset: number;
  range: SlideRange;
  onChange: (offset: number) => void;
  valueText: string;
}) {
  const scales = usePlotScales();
  const { cx, cy, scale } = handlePlace({ axis, home, offset, range, scales });

  return (
    <ActivityPlaceHandle
      className={className}
      cx={cx}
      cy={cy}
      disabled={disabled}
      label={label}
      onChange={onChange}
      orientation={axis}
      range={range}
      scale={scale}
      value={offset}
      valueText={valueText}
    >
      <circle
        className="fill-background stroke-current"
        cx={cx}
        cy={cy}
        r={HANDLE_RADIUS}
        strokeWidth={HANDLE_STROKE}
      />
      <path
        className="fill-none stroke-current"
        d={chevrons({ axis, cx, cy })}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </ActivityPlaceHandle>
  );
}
