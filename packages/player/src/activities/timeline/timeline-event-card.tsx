"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, GripVertical, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { type Ref } from "react";
import { type TimelineAxis } from "./use-timeline-axis";

/** Where cards start, from the left edge of the track: right of the axis and its dots. */
export const CARD_LEFT = 96;

export type TrackEvent = {
  guess: number;
  id: string;
  isRevealed: boolean;
  label: string;
  result: "correct" | "incorrect" | null;
  year: number;
};

/** Keys that move a placed event, in steps; down the screen is later in time. */
const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
  PageDown: 10,
  PageUp: -10,
};

function keyedYear({
  axis,
  key,
  step,
  year,
}: {
  axis: TimelineAxis;
  key: string;
  step: number;
  year: number;
}) {
  if (key === "Home") {
    return axis.start;
  }

  if (key === "End") {
    return axis.end;
  }

  const steps = KEY_STEPS[key];
  return steps === undefined ? null : Math.min(Math.max(year + steps * step, axis.start), axis.end);
}

function ResultIcon({ result }: { result: TrackEvent["result"] }) {
  if (result === "correct") {
    return <Check aria-hidden="true" className="text-success size-4 shrink-0" />;
  }

  return result === "incorrect" ? (
    <X aria-hidden="true" className="text-destructive size-4 shrink-0" />
  ) : null;
}

/** A placed event the learner can still move: a vertical slider for keyboards, draggable. */
export function EventCard({
  axis,
  cardRef,
  disabled,
  event,
  formatYear,
  onMove,
  step,
  top,
  yearAt,
}: {
  axis: TimelineAxis;
  cardRef: Ref<HTMLDivElement>;
  disabled: boolean;
  event: TrackEvent;
  formatYear: (year: number) => string;
  onMove: (year: number) => void;
  step: number;
  top: number;
  yearAt: (event: { clientX: number; clientY: number }) => { year: number } | null;
}) {
  const t = useExtracted();
  const isMovable = !disabled && !event.isRevealed;

  function handleKeyDown(keyEvent: React.KeyboardEvent<HTMLDivElement>) {
    const next = isMovable ? keyedYear({ axis, key: keyEvent.key, step, year: event.guess }) : null;

    if (next !== null) {
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      onMove(next);
    }
  }

  function handlePointer(pointerEvent: React.PointerEvent<HTMLDivElement>) {
    const target = yearAt(pointerEvent);

    if (target) {
      onMove(target.year);
    }
  }

  return (
    <div
      aria-disabled={!isMovable || undefined}
      aria-label={event.label}
      aria-orientation="vertical"
      aria-valuemax={axis.end}
      aria-valuemin={axis.start}
      aria-valuenow={event.isRevealed ? event.year : event.guess}
      aria-valuetext={
        event.isRevealed
          ? t("{year}. Your guess: {guess}", {
              guess: formatYear(event.guess),
              year: formatYear(event.year),
            })
          : formatYear(event.guess)
      }
      className={cn(
        "bg-background focus-visible:ring-ring/50 absolute right-0 flex min-h-11 -translate-y-1/2 items-center gap-2 rounded-2xl border px-3 py-1.5 outline-none select-none focus-visible:ring-[3px] motion-safe:transition-[top] motion-safe:duration-300",
        isMovable && "border-viz-accent cursor-grab touch-none shadow-sm active:cursor-grabbing",
        event.result === "incorrect" && "border-destructive/60",
        event.result === "correct" && "border-success/60",
      )}
      data-slot="timeline-event"
      onKeyDown={handleKeyDown}
      onPointerDown={(pointerEvent) => {
        if (isMovable) {
          pointerEvent.stopPropagation();
          pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
        }
      }}
      onPointerMove={(pointerEvent) => {
        if (isMovable && pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
          handlePointer(pointerEvent);
        }
      }}
      ref={cardRef}
      role="slider"
      style={{ left: CARD_LEFT, top }}
      tabIndex={disabled && !event.isRevealed ? -1 : 0}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <p
          className={cn(
            "text-xs font-semibold tabular-nums",
            event.isRevealed ? "text-foreground" : "text-viz-accent",
          )}
        >
          {formatYear(event.isRevealed ? event.year : event.guess)}
        </p>
        <p className="text-sm leading-snug font-medium">{event.label}</p>
        {event.isRevealed && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {t("Your guess: {guess}", { guess: formatYear(event.guess) })}
          </p>
        )}
      </div>

      {isMovable ? (
        <GripVertical aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      ) : (
        <ResultIcon result={event.result} />
      )}
    </div>
  );
}
