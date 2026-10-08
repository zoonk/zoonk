"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type Ref } from "react";
import { CARD_LEFT, EventCard, type TrackEvent } from "./timeline-event-card";
import { spreadLabels, yearTicks } from "./timeline-scale";
import { type TimelineAxis, yearToY } from "./use-timeline-axis";

/** Where the axis runs, from the left edge of the track. */
const AXIS_X = 76;
const DOT_RADIUS = 6;

type TrackAnchor = { label: string; year: number };

type Placed = {
  id: string;
  kind: "anchor" | "event";
  label: string;
  shownYear: number;
  event: TrackEvent | null;
};

function TickLabels({
  axis,
  formatYear,
}: {
  axis: TimelineAxis;
  formatYear: (year: number) => string;
}) {
  return yearTicks(axis.start, axis.end).map((tick) => (
    <span
      aria-hidden="true"
      className="text-muted-foreground absolute right-[calc(100%-4.25rem)] -translate-y-1/2 text-xs whitespace-nowrap tabular-nums"
      key={tick}
      style={{ top: yearToY(tick, axis) }}
    >
      {formatYear(tick)}
    </span>
  ));
}

/** Lines, dots and colored spans between known dates, drawn under the cards. */
function TrackDrawing({
  axis,
  cardYs,
  items,
}: {
  axis: TimelineAxis;
  cardYs: readonly number[];
  items: readonly Placed[];
}) {
  const known = items
    .filter((item) => item.kind === "anchor" || item.event?.isRevealed)
    .toSorted((a, b) => a.shownYear - b.shownYear);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      <path
        className="stroke-border"
        d={`M${AXIS_X} ${yearToY(axis.start, axis)} V${yearToY(axis.end, axis)}`}
        strokeWidth={2}
      />

      {known.slice(1).map((item, index) => (
        <path
          className={index % 2 === 0 ? "stroke-viz-highlight" : "stroke-viz-secondary"}
          d={`M${AXIS_X} ${yearToY(known[index]?.shownYear ?? item.shownYear, axis)} V${yearToY(item.shownYear, axis)}`}
          key={item.id}
          strokeLinecap="round"
          strokeWidth={4}
        />
      ))}

      {items.map((item, index) => {
        const dotY = yearToY(item.shownYear, axis);
        const guess = item.event?.isRevealed ? yearToY(item.event.guess, axis) : null;
        const isGuessing = item.event !== null && !item.event.isRevealed;

        return (
          <g key={item.id}>
            {guess !== null && guess !== dotY && (
              <>
                <path
                  className="stroke-viz-accent/50"
                  d={`M${AXIS_X} ${guess} V${dotY}`}
                  strokeDasharray="3 3"
                  strokeWidth={2}
                />
                <circle
                  className="fill-background stroke-viz-accent"
                  cx={AXIS_X}
                  cy={guess}
                  r={DOT_RADIUS - 1}
                  strokeWidth={2}
                />
              </>
            )}
            <path
              className={isGuessing ? "stroke-viz-accent" : "stroke-border"}
              d={`M${AXIS_X + DOT_RADIUS} ${dotY} L${CARD_LEFT} ${cardYs[index] ?? dotY}`}
              strokeDasharray={isGuessing ? "4 3" : undefined}
              strokeWidth={1.5}
            />
            <circle
              className={cn(
                isGuessing ? "fill-viz-accent" : "fill-foreground",
                "stroke-background",
              )}
              cx={AXIS_X}
              cy={dotY}
              r={DOT_RADIUS}
              strokeWidth={3}
            />
          </g>
        );
      })}
    </svg>
  );
}

function AnchorCard({
  formatYear,
  item,
  top,
}: {
  formatYear: (year: number) => string;
  item: Placed;
  top: number;
}) {
  return (
    <div
      className="bg-background absolute right-0 flex min-h-11 -translate-y-1/2 flex-col justify-center rounded-2xl border px-3 py-1.5"
      style={{ left: CARD_LEFT, top }}
    >
      <p className="text-muted-foreground text-xs tabular-nums">{formatYear(item.shownYear)}</p>
      <p className="text-sm leading-snug">{item.label}</p>
    </div>
  );
}

/**
 * The timeline itself: a to-scale vertical axis with dated anchors, the learner's placed events
 * and, once revealed, where each event really belongs next to the learner's guess.
 */
export function TimelineTrack({
  anchors,
  axis,
  cardGap,
  cardRefs,
  disabled,
  events,
  formatYear,
  onMove,
  step,
  trackRef,
  yearAt,
}: {
  anchors: readonly TrackAnchor[];
  axis: TimelineAxis;
  cardGap: number;
  cardRefs: (id: string) => Ref<HTMLDivElement>;
  disabled: boolean;
  events: readonly TrackEvent[];
  formatYear: (year: number) => string;
  onMove: (id: string, year: number) => void;
  step: number;
  trackRef: Ref<HTMLDivElement>;
  yearAt: (event: { clientX: number; clientY: number }) => { year: number } | null;
}) {
  const items: Placed[] = [
    ...anchors.map((anchor) => ({
      event: null,
      id: `anchor-${anchor.year}-${anchor.label}`,
      kind: "anchor" as const,
      label: anchor.label,
      shownYear: anchor.year,
    })),
    ...events.map((event) => ({
      event,
      id: event.id,
      kind: "event" as const,
      label: event.label,
      shownYear: event.isRevealed ? event.year : event.guess,
    })),
  ];

  const cardYs = spreadLabels({
    bottom: axis.height - cardGap / 2,
    gap: cardGap,
    positions: items.map((item) => yearToY(item.shownYear, axis)),
    top: cardGap / 2,
  });

  return (
    <div
      className="relative w-full"
      data-slot="timeline-track"
      ref={trackRef}
      style={{ height: axis.height }}
    >
      <TickLabels axis={axis} formatYear={formatYear} />
      <TrackDrawing axis={axis} cardYs={cardYs} items={items} />

      {items.map((item, index) =>
        item.event ? (
          <EventCard
            axis={axis}
            cardRef={cardRefs(item.event.id)}
            disabled={disabled}
            event={item.event}
            formatYear={formatYear}
            key={item.id}
            onMove={(year) => onMove(item.id, year)}
            step={step}
            top={cardYs[index] ?? 0}
            yearAt={yearAt}
          />
        ) : (
          <AnchorCard formatYear={formatYear} item={item} key={item.id} top={cardYs[index] ?? 0} />
        ),
      )}
    </div>
  );
}
