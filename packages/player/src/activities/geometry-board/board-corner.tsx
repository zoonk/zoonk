"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { svgPoint } from "../_components/activity-place-handle";
import { type BoardBounds, type BoardPoint, keyOffset } from "./board-geometry";
import { type BoardScale } from "./board-scale";

type Vector = { x: number; y: number };

/** Half of the 44px touch target around every corner. */
const HIT_RADIUS = 22;
const HALO_RADIUS = 17;
const HANDLE_RADIUS = 9;
const FIXED_RADIUS = 5.5;

/** A corner that stays put: a small open dot, so what can move stands out. */
export function BoardFixedCorner({ pixel }: { pixel: Vector }) {
  return (
    <circle
      aria-hidden="true"
      className="fill-background stroke-foreground"
      cx={pixel.x}
      cy={pixel.y}
      r={FIXED_RADIUS}
      strokeWidth={2}
    />
  );
}

/**
 * A corner the learner moves: dragged with a pointer (44px target) or moved one grid step per
 * arrow key. It's announced as a slider along its track (or across the board), with its position
 * and what the board measures in the spoken value.
 */
export function BoardCorner({
  bounds,
  descriptionId,
  disabled,
  label,
  onMoveBy,
  onMoveTo,
  pixel,
  point,
  scale,
  step,
  valueText,
}: {
  bounds: BoardBounds;
  descriptionId: string;
  disabled: boolean;
  label: string;
  onMoveBy: (offset: Vector) => void;
  onMoveTo: (point: Vector) => void;
  pixel: Vector;
  point: BoardPoint;
  scale: BoardScale;
  step: number;
  valueText: string;
}) {
  const t = useExtracted();
  const isVertical = point.track === "vertical";

  function handleKeyDown(event: React.KeyboardEvent<SVGGElement>) {
    const offset = disabled ? null : keyOffset({ key: event.key, step, track: point.track });

    if (offset) {
      event.preventDefault();
      event.stopPropagation();
      onMoveBy(offset);
    }
  }

  function handlePointer(event: React.PointerEvent<SVGGElement>) {
    const position = svgPoint(event);

    if (position) {
      onMoveTo(scale.toData(position));
    }
  }

  return (
    <g
      aria-describedby={descriptionId}
      aria-disabled={disabled || undefined}
      aria-label={label}
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      aria-roledescription={t("movable corner")}
      aria-valuemax={isVertical ? bounds.maxY : bounds.maxX}
      aria-valuemin={isVertical ? bounds.minY : bounds.minX}
      aria-valuenow={isVertical ? point.y : point.x}
      aria-valuetext={valueText}
      className={cn(
        "group/corner touch-none outline-none",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      )}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (!disabled) {
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointer(event);
        }
      }}
      onPointerMove={(event) => {
        if (!disabled && event.currentTarget.hasPointerCapture(event.pointerId)) {
          handlePointer(event);
        }
      }}
      role="slider"
      tabIndex={disabled ? -1 : 0}
    >
      <circle className="fill-transparent" cx={pixel.x} cy={pixel.y} r={HIT_RADIUS} />
      <circle
        className={cn("fill-foreground/10 motion-safe:transition-opacity", disabled && "opacity-0")}
        cx={pixel.x}
        cy={pixel.y}
        r={HIT_RADIUS}
      />
      <circle
        className="stroke-ring fill-none opacity-0 group-focus-visible/corner:opacity-100"
        cx={pixel.x}
        cy={pixel.y}
        r={HALO_RADIUS}
        strokeWidth={3}
      />
      <circle
        className="fill-foreground stroke-background"
        cx={pixel.x}
        cy={pixel.y}
        r={HANDLE_RADIUS}
        strokeWidth={2.5}
      />
    </g>
  );
}
