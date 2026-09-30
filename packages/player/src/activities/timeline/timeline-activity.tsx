"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { useFormatNumber } from "../_utils/use-format-number";
import { useMeasuredWidth } from "../_utils/use-measured-width";
import { type ActivityRendererProps } from "../activity-renderer";
import { type TrackEvent } from "./timeline-event-card";
import { TimelineGaps } from "./timeline-gaps";
import { placedOrder, snapYear, yearLabel, yearStep } from "./timeline-scale";
import { TimelineTrack } from "./timeline-track";
import { TimelineTray } from "./timeline-tray";
import { useTimelineAxis } from "./use-timeline-axis";

type TimelineProps = ActivityRendererProps<"timeline">;
type Placement = { id: string; year: number };

const FALLBACK_WIDTH = 318;
const MIN_HEIGHT = 320;
/** Rough width of a character at 14px, to guess how many lines a card's label takes. */
const CHARACTER_WIDTH = 7.2;
const CARD_CHROME = 150;
const LINE_HEIGHT = 20;
const CARD_BASE = 34;

function useFormatYear(start: number) {
  const t = useExtracted();
  const format = useFormatNumber();

  return (year: number) => {
    const label = yearLabel(year, { start });
    const value = format(label.year, { grouping: false });

    if (label.era === "bce") {
      return t("{year} BCE", { year: value });
    }

    return label.era === "ce" ? t("{year} CE", { year: value }) : value;
  };
}

/** Space each card needs, from its longest label at the track's width. */
function cardGap(labels: readonly string[], width: number): number {
  const longest = Math.max(...labels.map((label) => label.length), 1);
  const lines = Math.ceil((longest * CHARACTER_WIDTH) / Math.max(width - CARD_CHROME, 1));
  return CARD_BASE + LINE_HEIGHT * Math.max(lines, 1);
}

function resultOf({
  expected,
  id,
  order,
}: {
  expected: TimelineProps["expected"];
  id: string;
  order: readonly string[];
}): TrackEvent["result"] {
  if (expected?.kind !== "interaction" || expected.answer.kind !== "order") {
    return null;
  }

  return expected.answer.ids.indexOf(id) === order.indexOf(id) ? "correct" : "incorrect";
}

/**
 * Events placed on a true-to-scale axis, to feel how far apart they are. The learner drags each
 * event onto the timeline (or places it and moves it with the arrow keys), then sees where it
 * really belongs next to the guess, with the years between known dates. With an order check the
 * placed order is the answer; with a question the learner reveals the real dates first.
 */
export function TimelineActivity({
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: TimelineProps) {
  const t = useExtracted();
  const { check, fields } = content;
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const cards = useRef(new Map<string, HTMLDivElement>());
  const isChecked = phase === "checked";
  const formatYear = useFormatYear(fields.start);
  const labels = [...fields.anchors, ...fields.events].map((item) => item.label);
  const gap = cardGap(labels, width);

  const axis = {
    end: fields.end,
    height: Math.max(MIN_HEIGHT, gap * (labels.length + 1)),
    start: fields.start,
  };

  const { trackRef, yearAt } = useTimelineAxis(axis);
  const showTruth = isRevealed || isChecked;
  const order = placedOrder(placements);

  const unplaced = fields.events.filter(
    (event) => !placements.some((placement) => placement.id === event.id),
  );

  const trayEvent = fields.events.find((event) => event.id === dragId) ?? unplaced[0];

  useEffect(() => {
    if (focusId) {
      cards.current.get(focusId)?.focus();
    }
  }, [focusId]);

  function update(next: Placement[]) {
    setPlacements(next);

    if (check.kind === "interaction") {
      const isComplete = next.length === fields.events.length;
      onAnswerChange(isComplete ? { ids: placedOrder(next), kind: "order" } : null);
    }
  }

  function place(id: string, year: number | null) {
    const others = placements.filter((placement) => placement.id !== id);
    const existing = placements.find((placement) => placement.id === id);

    if (year === null) {
      update(others);
      return;
    }

    update(
      existing
        ? placements.map((item) => (item.id === id ? { id, year } : item))
        : [...others, { id, year }],
    );
  }

  const trackEvents: TrackEvent[] = fields.events.flatMap((event) => {
    const guess = placements.find((placement) => placement.id === event.id)?.year;

    if (guess === undefined && !isChecked) {
      return [];
    }

    return [
      {
        guess: guess ?? event.year,
        id: event.id,
        isRevealed: showTruth,
        label: event.label,
        result: isChecked ? resultOf({ expected, id: event.id, order }) : null,
        year: event.year,
      },
    ];
  });

  return (
    <ActivityCanvas labelId={labelId}>
      <div ref={ref}>
        <TimelineTrack
          anchors={fields.anchors}
          axis={axis}
          cardGap={gap}
          cardRefs={(id) => (element) => {
            if (element) {
              cards.current.set(id, element);
            } else {
              cards.current.delete(id);
            }
          }}
          disabled={isChecked || showTruth}
          events={trackEvents}
          formatYear={formatYear}
          onMove={(id, year) => place(id, year)}
          step={yearStep(fields.start, fields.end)}
          trackRef={trackRef}
          yearAt={yearAt}
        />
      </div>

      {!isChecked && trayEvent && (
        <TimelineTray
          label={trayEvent.label}
          onDragEnd={() => setDragId(null)}
          onDragMove={(point) => {
            const target = yearAt(point);
            place(trayEvent.id, target?.inside ? target.year : null);
          }}
          onDragStart={() => setDragId(trayEvent.id)}
          onPlace={() => {
            place(trayEvent.id, snapYear((fields.start + fields.end) / 2, fields));
            setFocusId(trayEvent.id);
          }}
          remaining={unplaced.length}
        />
      )}

      {check.kind === "choice" && !showTruth && unplaced.length === 0 && (
        <Button className="self-start" onClick={() => setIsRevealed(true)} variant="outline">
          {t("Show the real dates")}
        </Button>
      )}

      <div aria-live="polite">
        {showTruth && (
          <TimelineGaps anchors={fields.anchors} events={fields.events} formatYear={formatYear} />
        )}
      </div>

      <ActivityTextAlternative>
        {t("A timeline from {start} to {end}.", {
          end: formatYear(fields.end),
          start: formatYear(fields.start),
        })}{" "}
        {fields.anchors
          .map((anchor) =>
            t("{label}: {year}.", { label: anchor.label, year: formatYear(anchor.year) }),
          )
          .join(" ")}{" "}
        {trackEvents
          .map((event) =>
            event.isRevealed
              ? t("{label}: {year}, your guess was {guess}.", {
                  guess: formatYear(event.guess),
                  label: event.label,
                  year: formatYear(event.year),
                })
              : t("{label}: placed at {year}.", {
                  label: event.label,
                  year: formatYear(event.guess),
                }),
          )
          .join(" ")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
