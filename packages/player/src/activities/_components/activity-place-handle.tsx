"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type LinearScale } from "@zoonk/utils/plot-scale";
import { type SnapRange, snapToStep, valueAfterKey } from "../_utils/snap-value";

type Orientation = "horizontal" | "vertical";

/** Half of the 44px touch target around every handle. */
const HIT_RADIUS = 22;
const FOCUS_RADIUS = 17;

/** A pointer position in the SVG's own coordinates, whatever size the SVG is drawn at. */
export function svgPoint(event: React.PointerEvent<SVGElement>): { x: number; y: number } | null {
  const svg = event.currentTarget.ownerSVGElement;
  const matrix = svg?.getScreenCTM();

  if (!matrix) {
    return null;
  }

  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

/** A vertical handle whose value grows down the screen, like a cut measured from the top. */
function growsDownward(orientation: Orientation, scale: LinearScale): boolean {
  return (
    orientation === "vertical" &&
    scale.range[1] > scale.range[0] === scale.domain[1] > scale.domain[0]
  );
}

/** Arrow keys follow what the learner sees: the down arrow moves a handle down the screen. */
function flipVerticalKey(key: string): string {
  if (key === "ArrowUp") {
    return "ArrowDown";
  }

  return key === "ArrowDown" ? "ArrowUp" : key;
}

/**
 * Pointer handlers that turn a press or drag anywhere on an element (a track, a handle) into a
 * snapped value along one axis. Pointer capture keeps the drag going outside the element.
 */
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

/**
 * Something the learner places along an axis: a dot on a number line, a split line on a
 * rectangle. It's a slider for keyboards and screen readers (arrows, Page Up/Down, Home/End,
 * a spoken value) and a drag target for pointers, with a 44px hit area around its drawing.
 */
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
