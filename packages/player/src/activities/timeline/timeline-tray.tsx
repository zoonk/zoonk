"use client";

import { GripVertical } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef } from "react";

type PointerPoint = { clientX: number; clientY: number };

/** How far a press must move before it counts as a drag rather than a tap. */
const DRAG_DISTANCE = 6;

/**
 * The next event to place. Dragging it onto the timeline drops it where the pointer lets go;
 * pressing it (or Enter and Space) puts it in the middle, to fine-tune with a drag or the arrows.
 */
export function TimelineTray({
  label,
  onDragEnd,
  onDragMove,
  onDragStart,
  onPlace,
  remaining,
}: {
  label: string;
  onDragEnd: () => void;
  onDragMove: (point: PointerPoint) => void;
  onDragStart: () => void;
  onPlace: () => void;
  remaining: number;
}) {
  const t = useExtracted();
  const hasDragged = useRef(false);
  const start = useRef<PointerPoint | null>(null);

  return (
    <div className="flex flex-col gap-2" data-slot="timeline-tray">
      <p className="text-muted-foreground text-xs">
        {t("{count, plural, one {# event to place} other {# events to place}}", {
          count: remaining,
        })}
      </p>

      <button
        aria-label={t("Place {event} on the timeline", { event: label })}
        className="bg-background border-viz-accent focus-visible:ring-ring/50 hover:bg-accent flex min-h-11 w-full cursor-grab touch-none items-center gap-3 rounded-2xl border-2 border-dashed px-3 py-2 text-left outline-none select-none focus-visible:ring-[3px] active:cursor-grabbing"
        onClick={() => {
          if (!hasDragged.current) {
            onPlace();
          }

          hasDragged.current = false;
        }}
        onPointerDown={(event) => {
          hasDragged.current = false;
          start.current = { clientX: event.clientX, clientY: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
          onDragStart();
        }}
        onPointerMove={(event) => {
          const from = start.current;

          if (!from || !event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
          }

          hasDragged.current ||=
            Math.hypot(event.clientX - from.clientX, event.clientY - from.clientY) > DRAG_DISTANCE;

          if (hasDragged.current) {
            onDragMove(event);
          }
        }}
        onPointerUp={onDragEnd}
        type="button"
      >
        <GripVertical aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        <span className="flex-1 text-sm font-medium">{label}</span>
        <span aria-hidden="true" className="text-muted-foreground text-xs">
          {t("Drag onto the timeline")}
        </span>
      </button>
    </div>
  );
}
