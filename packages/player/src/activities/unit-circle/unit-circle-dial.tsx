"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { svgPoint } from "../_components/activity-place-handle";
import { useMeasuredWidth } from "../_utils/use-measured-width";
import { FULL_TURN, angleAfterKey, pointerAngle, snapAngle } from "./unit-circle-angle";
import { DialLabel, TangentMark, TrigLegs, arcPath, onCircle } from "./unit-circle-marks";
import { type TrigName, useTrigNames } from "./use-unit-circle-format";

type Vector = { x: number; y: number };
type TrigValues = Partial<Record<TrigName, number | null>>;

/** Phone width of the canvas, used until the real width is measured. */
const FALLBACK_WIDTH = 318;
const MAX_SIZE = 300;
const RADIUS_SHARE = 0.34;
const HIT_RADIUS = 22;
const FOCUS_RADIUS = 17;
const HANDLE_RADIUS = 9;
const TARGET_RADIUS = 7;
const ARC_RADIUS = 22;
const LABEL_GAP = 8;
const ANGLE_LABEL_GAP = 16;
const HALF_TURN = 180;
const TARGET_LABEL_GAP = 14;
/** Labels within this many degrees of the horizontal axis would sit on the cosine's side. */
const AXIS_CLEARANCE = 25;
/** How far from straight up or down a label still reads as centered over its point. */
const SIDE_THRESHOLD = 0.35;

/** Text beside a point on the circle reads outward: to the right on the right half, and so on. */
function sideAnchor(degrees: number): "end" | "middle" | "start" {
  const across = Math.cos((degrees * Math.PI) / HALF_TURN);

  if (across > SIDE_THRESHOLD) {
    return "start";
  }

  return across < -SIDE_THRESHOLD ? "end" : "middle";
}

/** The angle's label sits in the middle of its arc, kept off the horizontal axis. */
function angleLabelDirection(degrees: number): number {
  return Math.min(Math.max(degrees / 2, AXIS_CLEARANCE), FULL_TURN - AXIS_CLEARANCE);
}

/** The point to turn: 44px to grab, a slider for keyboards and screen readers. */
function DialHandle({
  disabled,
  label,
  onKeyDown,
  onPointer,
  point,
  value,
  valueText,
}: {
  disabled: boolean;
  label: string;
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => void;
  onPointer: (event: React.PointerEvent<SVGGElement>) => void;
  point: Vector;
  value: number;
  valueText: string;
}) {
  return (
    <g
      aria-disabled={disabled || undefined}
      aria-label={label}
      aria-valuemax={FULL_TURN}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn(
        "group/point touch-none outline-none",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      )}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (!disabled) {
          event.currentTarget.setPointerCapture(event.pointerId);
          onPointer(event);
        }
      }}
      onPointerMove={(event) => {
        if (!disabled && event.currentTarget.hasPointerCapture(event.pointerId)) {
          onPointer(event);
        }
      }}
      role="slider"
      tabIndex={disabled ? -1 : 0}
    >
      <circle
        className={cn("fill-foreground/10", disabled && "opacity-0")}
        cx={point.x}
        cy={point.y}
        r={HIT_RADIUS}
      />
      <circle
        className="stroke-ring fill-none opacity-0 group-focus-visible/point:opacity-100"
        cx={point.x}
        cy={point.y}
        r={FOCUS_RADIUS}
        strokeWidth={3}
      />
      <circle
        className="fill-foreground stroke-background"
        cx={point.x}
        cy={point.y}
        r={HANDLE_RADIUS}
        strokeWidth={2.5}
      />
    </g>
  );
}

/**
 * A circle of radius 1 with a point to turn around it. Its height is the sine and its sideways
 * distance the cosine, drawn as colored sides of the triangle they make with the radius. The
 * point is a slider for keyboards (arrows turn it, Page keys an eighth of a turn) and a drag
 * target for pointers.
 */
export function UnitCircleDial({
  angleLabel,
  degrees,
  disabled,
  formatValue,
  label,
  onChange,
  show,
  step,
  target,
  values,
  valueText,
}: {
  angleLabel: string;
  degrees: number;
  disabled: boolean;
  formatValue: (value: number | null) => string;
  label: string;
  onChange: (degrees: number) => void;
  show: readonly TrigName[];
  step: number;
  /** The angle the check asks about, marked once checked. */
  target: { degrees: number; label: string } | null;
  values: TrigValues;
  valueText: string;
}) {
  const names = useTrigNames();
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const size = Math.min(width, MAX_SIZE);
  const radius = size * RADIUS_SHARE;
  const center = { x: width / 2, y: size / 2 };
  const point = onCircle(center, radius, degrees);

  function handleKeyDown(event: React.KeyboardEvent<SVGGElement>) {
    const next = disabled ? null : angleAfterKey({ degrees, key: event.key, step });

    if (next !== null) {
      event.preventDefault();
      event.stopPropagation();
      onChange(next);
    }
  }

  function handlePointer(event: React.PointerEvent<SVGGElement>) {
    const pixel = svgPoint(event);

    if (pixel) {
      onChange(snapAngle(pointerAngle(center, pixel), step));
    }
  }

  return (
    <div className="w-full" ref={ref}>
      <svg
        className="block overflow-visible"
        height={size}
        viewBox={`0 0 ${width} ${size}`}
        width={width}
      >
        <g aria-hidden="true" className="stroke-border" strokeWidth={1.5}>
          <path
            d={`M${center.x - radius - HIT_RADIUS} ${center.y} H${center.x + radius + HIT_RADIUS}`}
          />
          <path
            d={`M${center.x} ${center.y - radius - HIT_RADIUS} V${center.y + radius + HIT_RADIUS}`}
          />
        </g>

        <circle
          aria-hidden="true"
          className="stroke-muted-foreground fill-none"
          cx={center.x}
          cy={center.y}
          r={radius}
          strokeWidth={2}
        />

        {target && (
          <DialLabel
            anchor={sideAnchor(target.degrees)}
            className="fill-success"
            point={onCircle(center, radius + TARGET_LABEL_GAP, target.degrees)}
          >
            {target.label}
          </DialLabel>
        )}

        {target && (
          <circle
            aria-hidden="true"
            className="fill-background stroke-success"
            cx={onCircle(center, radius, target.degrees).x}
            cy={onCircle(center, radius, target.degrees).y}
            r={TARGET_RADIUS}
            strokeWidth={2.5}
          />
        )}

        {degrees > 0 && degrees < FULL_TURN && (
          <path
            aria-hidden="true"
            className="stroke-muted-foreground fill-none"
            d={arcPath(center, ARC_RADIUS, degrees)}
            strokeWidth={1.5}
          />
        )}

        <path
          aria-hidden="true"
          className="stroke-foreground"
          d={`M${center.x} ${center.y} L${point.x} ${point.y}`}
          strokeWidth={2}
        />

        <TrigLegs
          canvas={{ height: size, width }}
          center={center}
          formatValue={formatValue}
          names={names}
          point={point}
          show={show}
          values={values}
        />

        {show.includes("tan") && (
          <TangentMark
            center={center}
            formatValue={formatValue}
            limit={size / 2 - LABEL_GAP}
            name={names.tan}
            radius={radius}
            value={values.tan ?? null}
          />
        )}

        <DialLabel
          anchor="middle"
          className="fill-muted-foreground text-xs"
          point={onCircle(center, ARC_RADIUS + ANGLE_LABEL_GAP, angleLabelDirection(degrees))}
        >
          {angleLabel}
        </DialLabel>

        <DialHandle
          disabled={disabled}
          label={label}
          onKeyDown={handleKeyDown}
          onPointer={handlePointer}
          point={point}
          value={degrees}
          valueText={valueText}
        />
      </svg>
    </div>
  );
}
