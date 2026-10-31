"use client";

import { ActivityPlaceHandle } from "../_components/activity-place-handle";
import { usePlotScales } from "../_components/activity-plot";
import { type LineSlide, type Point, type ShiftAxis } from "./line-crossing-model";

export const HANDLE_RADIUS = 14;
export const HANDLE_STROKE = 2.5;
const CHEVRON = 4;

function chevrons({ axis, cx, cy }: { axis: ShiftAxis; cx: number; cy: number }): string {
  return axis === "horizontal"
    ? `M${cx - 2} ${cy - CHEVRON} l-${CHEVRON} ${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx + 2} ${cy - CHEVRON} l${CHEVRON} ${CHEVRON} l-${CHEVRON} ${CHEVRON}`
    : `M${cx - CHEVRON} ${cy - 2} l${CHEVRON} -${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx - CHEVRON} ${cy + 2} l${CHEVRON} ${CHEVRON} l${CHEVRON} -${CHEVRON}`;
}

export function LineHandle({
  axis,
  className,
  disabled,
  label,
  offset,
  onChange,
  slide,
  valueText,
}: {
  axis: ShiftAxis;
  className: string;
  disabled: boolean;
  label: string;
  offset: number;
  onChange: (offset: number) => void;
  slide: LineSlide;
  valueText: string;
}) {
  const scales = usePlotScales();
  const pixel = (point: Point) => ({ x: scales.x.toPixel(point.x), y: scales.y.toPixel(point.y) });
  const { x: cx, y: cy } = pixel(slide.at(offset));

  const nearestOffset = (pointer: Point) => {
    const gap = (candidate: number) => {
      const spot = pixel(slide.at(candidate));
      return Math.hypot(spot.x - pointer.x, spot.y - pointer.y);
    };

    return slide.offsets.toSorted((first, second) => gap(first) - gap(second))[0] ?? offset;
  };

  return (
    <ActivityPlaceHandle
      className={className}
      cx={cx}
      cy={cy}
      disabled={disabled}
      label={label}
      onChange={onChange}
      orientation={axis}
      range={slide.range}
      scale={axis === "horizontal" ? scales.x : scales.y}
      value={offset}
      valueAt={nearestOffset}
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
