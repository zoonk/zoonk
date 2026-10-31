"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useSentenceSpace } from "@zoonk/learn/locale";
import { Button } from "@zoonk/ui/components/button";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { type TrackEvent, hasShownGuess } from "./timeline-event-card";
import { TimelineGaps } from "./timeline-gaps";
import { placedOrder, snapYear, yearLabel, yearStep } from "./timeline-scale";
import { TimelineTrack } from "./timeline-track";
import { TimelineTray } from "./timeline-tray";
import { useTimelineAxis } from "./use-timeline-axis";

type TimelineProps = ActivityRendererProps<"timeline">;
type Placement = { id: string; year: number };

const FALLBACK_WIDTH = 318;
const MIN_HEIGHT = 320;
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

function cardGap(labels: readonly string[], width: number): number {
  const longest = Math.max(...labels.map((label) => label.length), 1);
  const lines = Math.ceil((longest * CHARACTER_WIDTH) / Math.max(width - CARD_CHROME, 1));
  return CARD_BASE + LINE_HEIGHT * Math.max(lines, 1);
}

function resultOf({
  answer,
  expected,
  id,
}: Pick<TimelineProps, "answer" | "expected"> & { id: string }): TrackEvent["result"] {
  if (
    answer?.kind !== "order" ||
    expected?.kind !== "interaction" ||
    expected.answer.kind !== "order"
  ) {
    return null;
  }

  return expected.answer.ids.indexOf(id) === answer.ids.indexOf(id) ? "correct" : "incorrect";
}

function TimelineDescription({
  dated,
  end,
  events,
  formatYear,
  start,
}: {
  dated: readonly { label: string; year: number }[];
  end: number;
  events: readonly TrackEvent[];
  formatYear: (year: number) => string;
  start: number;
}) {
  const t = useExtracted();
  const space = useSentenceSpace();

  function describeEvent(event: TrackEvent) {
    if (!event.isRevealed) {
      return t("{label}: placed at {year}.", { label: event.label, year: formatYear(event.guess) });
    }

    return hasShownGuess(event)
      ? t("{label}: {year}, your guess was {guess}.", {
          guess: formatYear(event.guess),
          label: event.label,
          year: formatYear(event.year),
        })
      : t("{label}: {year}.", { label: event.label, year: formatYear(event.year) });
  }

  const sentences = [
    t("A timeline from {start} to {end}.", { end: formatYear(end), start: formatYear(start) }),
    ...dated.map((item) =>
      t("{label}: {year}.", { label: item.label, year: formatYear(item.year) }),
    ),
    ...events.map((event) => describeEvent(event)),
  ];

  return <ActivityTextAlternative>{sentences.join(space)}</ActivityTextAlternative>;
}

function ExploredTimeline({ content, labelId }: Pick<TimelineProps, "content" | "labelId">) {
  const { fields } = content;
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const formatYear = useFormatYear(fields.start);
  const dated = [...fields.anchors, ...fields.events].toSorted((a, b) => a.year - b.year);

  const gap = cardGap(
    dated.map((item) => item.label),
    width,
  );

  const axis = {
    end: fields.end,
    height: Math.max(MIN_HEIGHT, gap * (dated.length + 1)),
    start: fields.start,
  };

  const { trackRef, yearAt } = useTimelineAxis(axis);

  return (
    <ActivityCanvas labelId={labelId}>
      <div ref={ref}>
        <TimelineTrack
          anchors={dated}
          axis={axis}
          cardGap={gap}
          cardRefs={() => null}
          disabled
          events={[]}
          formatYear={formatYear}
          onMove={() => null}
          step={yearStep(fields.start, fields.end)}
          trackRef={trackRef}
          yearAt={yearAt}
        />
      </div>

      <TimelineGaps anchors={fields.anchors} events={fields.events} formatYear={formatYear} />

      <TimelineDescription
        dated={dated}
        end={fields.end}
        events={[]}
        formatYear={formatYear}
        start={fields.start}
      />
    </ActivityCanvas>
  );
}

function TimelineQuestion({
  answer,
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
        result: isChecked ? resultOf({ answer, expected, id: event.id }) : null,
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

      <TimelineDescription
        dated={fields.anchors}
        end={fields.end}
        events={trackEvents}
        formatYear={formatYear}
        start={fields.start}
      />
    </ActivityCanvas>
  );
}

export function TimelineActivity(props: TimelineProps) {
  return props.phase === "explore" ? (
    <ExploredTimeline content={props.content} labelId={props.labelId} />
  ) : (
    <TimelineQuestion {...props} />
  );
}
