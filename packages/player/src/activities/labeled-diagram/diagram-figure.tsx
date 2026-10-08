"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type DiagramShape } from "../_assets/diagrams/diagram-types";
import { useActivityDropTarget } from "../_components/activity-drag-drop";
import { DiagramArt, type PartMark } from "./diagram-art";
import { type DiagramSlot } from "./labeled-diagram-model";

const PERCENT = 100;

export type PinState = PartMark | "empty" | "filled";

/** The number badge a spot shows, on the drawing and in the list, in the spot's state. */
export function SpotNumber({
  className,
  number,
  state,
}: {
  className?: string;
  number: number;
  state: PinState;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums motion-safe:transition-[background-color,box-shadow,scale]",
        state === "empty" && "bg-background text-foreground ring-foreground/70 ring-2 ring-inset",
        state === "filled" && "bg-foreground text-background",
        state === "active" && "bg-viz-accent text-background ring-viz-accent/30 scale-110 ring-4",
        state === "correct" && "bg-success text-background",
        state === "incorrect" && "bg-destructive text-white",
        className,
      )}
    >
      {number}
    </span>
  );
}

/** A spot's pin on the drawing. Names can be dropped on it; the list below is the way to tap. */
function DiagramPin({
  drawing,
  slot,
  state,
}: {
  drawing: { height: number; width: number };
  slot: DiagramSlot;
  state: PinState;
}) {
  const { dropRef, isOver } = useActivityDropTarget({ id: `pin:${slot.partId}` });

  return (
    <span
      className="absolute flex size-11 -translate-1/2 items-center justify-center"
      ref={dropRef}
      style={{
        left: `${(slot.pin[0] / drawing.width) * PERCENT}%`,
        top: `${(slot.pin[1] / drawing.height) * PERCENT}%`,
      }}
    >
      <SpotNumber
        className={cn("shadow-sm", isOver && "ring-viz-accent scale-125 ring-4")}
        number={slot.number}
        state={state}
      />
    </span>
  );
}

/**
 * The checked drawing with a numbered pin on each part to label. It keeps its proportions and
 * a comfortable size, so pins stay put on their parts at any width.
 */
export function DiagramFigure({
  drawing,
  marks,
  pinStates,
  slots,
}: {
  drawing: { height: number; shapes: readonly DiagramShape[]; width: number };
  marks: ReadonlyMap<string, PartMark>;
  pinStates: ReadonlyMap<string, PinState>;
  slots: readonly DiagramSlot[];
}) {
  return (
    <div
      className="relative mx-auto w-full max-w-md"
      style={{ aspectRatio: `${drawing.width} / ${drawing.height}` }}
    >
      <DiagramArt
        height={drawing.height}
        marks={marks}
        shapes={drawing.shapes}
        slots={slots}
        width={drawing.width}
      />

      {slots.map((slot) => (
        <DiagramPin
          drawing={drawing}
          key={slot.partId}
          slot={slot}
          state={pinStates.get(slot.partId) ?? "empty"}
        />
      ))}
    </div>
  );
}
