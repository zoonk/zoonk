"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type LinearScale } from "@zoonk/utils/plot-scale";
import { type SnapRange, snapToStep, valueAfterKey } from "../_utils/snap-value";

type Orientation = "horizontal" | "vertical";

const HIT_RADIUS = 22;
const FOCUS_RADIUS = 17;

export function svgPoint(event: React.PointerEvent<SVGElement>): { x: number; y: number } | null {
  const svg = event.currentTarget.ownerSVGElement;
  const matrix = svg?.getScreenCTM();

  if (!matrix) {
    return null;
  }

  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

function growsDownward(orientation: Orientation, scale: LinearScale): boolean {
  return (
    orientation === "vertical" &&
    scale.range[1] > scale.range[0] === scale.domain[1] > scale.domain[0]
  );
}

function flipVerticalKey(key: string): string {
  if (key === "ArrowUp") {
    return "ArrowDown";
  }

  return key === "ArrowDown" ? "ArrowUp" : key;
}

export function usePlacePointer({
  disabled,
  onChange,
  orientation = "horizontal",
  range,
  scale,
}: {
  disabled?: boolean;
  onChange: (value: number) => void;
  orientation?: Orientation;
  range: SnapRange;
  scale: LinearScale;
}) {
  function place(event: React.PointerEvent<SVGElement>) {
    const point = svgPoint(event);

    if (point) {
      const position = orientation === "horizontal" ? point.x : point.y;
      onChange(snapToStep(scale.toValue(position), range));
    }
  }

  if (disabled) {
    return {};
  }

  return {
    onPointerDown: (event: React.PointerEvent<SVGElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      place(event);
    },
    onPointerMove: (event: React.PointerEvent<SVGElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        place(event);
      }
    },
  };
}

export function ActivityPlaceHandle({
  children,
  className,
  cx,
  cy,
  disabled,
  label,
  onChange,
  orientation = "horizontal",
  range,
  scale,
  value,
  valueText,
}: {
  children: React.ReactNode;
  className?: string;
  cx: number;
  cy: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
  orientation?: Orientation;
  range: SnapRange;
  scale: LinearScale;
  value: number;
  valueText: string;
}) {
  const pointer = usePlacePointer({ disabled, onChange, orientation, range, scale });

  function handleKeyDown(event: React.KeyboardEvent<SVGGElement>) {
    const key = growsDownward(orientation, scale) ? flipVerticalKey(event.key) : event.key;
    const next = disabled ? null : valueAfterKey(key, value, range);

    if (next !== null) {
      event.preventDefault();
      event.stopPropagation();
      onChange(next);
    }
  }

  return (
    <g
      aria-disabled={disabled || undefined}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemax={range.max}
      aria-valuemin={range.min}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn(
        "group/handle touch-none outline-none",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        className,
      )}
      data-slot="activity-place-handle"
      onKeyDown={handleKeyDown}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      {...pointer}
    >
      <circle className="fill-transparent" cx={cx} cy={cy} r={HIT_RADIUS} />
      <circle
        className="stroke-ring fill-none opacity-0 group-focus-visible/handle:opacity-100"
        cx={cx}
        cy={cy}
        r={FOCUS_RADIUS}
        strokeWidth={3}
      />
      {children}
    </g>
  );
}
