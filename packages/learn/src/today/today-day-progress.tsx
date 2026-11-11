"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { BigQuantity } from "../_components/big-quantity";
import { METER_PARTS_CLASS } from "../_components/meter";
import { moveFocusWithArrows } from "../_utils/arrow-focus";
import { useFormatDuration } from "../_utils/time-format";
import { getDayMeterParts } from "../session/day-meter-parts";
import { getSessionQueue } from "../session/session-queue-rows";
import { type DayStep } from "../session/session-types";
import { drawsDayMeter } from "./day-segments";
import { TodayContinueStatus, useTodayContinueSpeaking } from "./today-action";
import { useTodayScreen } from "./today-context";
import { BlockSegment, DAY_SEGMENT_SLOT, HeldSegment } from "./today-segment-popover";
import { getDayTime, getHeldMinutes } from "./today-time";

function getBlockShare(block: DayStep): number {
  if (block.status !== "active" || block.questions === 0) {
    return 0;
  }

  return Math.min(1, block.answered / block.questions);
}

const moveBetweenSegments = moveFocusWithArrows(DAY_SEGMENT_SLOT);

export function DayProgress({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks, nextPosition, sessionBar } = today.session;
  const next = blocks.find((block) => block.position === nextPosition);
  const held = getHeldMinutes(today.session);

  const parts = getDayMeterParts({
    nextShare: next ? getBlockShare(next) : 0,
    rows: getSessionQueue({ blocks, nextPosition }),
  });

  const focusPosition = next?.position ?? parts[0]?.block.position;

  if (!drawsDayMeter({ held: held > 0, parts })) {
    return null;
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The arrow keys move between the buttons inside.
    <div
      aria-label={t(
        "{done, plural, =0 {# of {total, number} done} one {# of {total, number} done} other {# of {total, number} done}}",
        { done: sessionBar.completed, total: sessionBar.total },
      )}
      className={cn(METER_PARTS_CLASS, className)}
      data-slot="today-day-progress"
      onKeyDown={moveBetweenSegments}
      role="group"
    >
      {parts.map((part) => (
        <BlockSegment focusable={part.block.position === focusPosition} key={part.id} part={part} />
      ))}
      {held > 0 && <HeldSegment minutes={held} />}
    </div>
  );
}

/** The minutes actually studied, never the plan's minutes for the blocks done. */
export function useStudiedToday(): number {
  const { today } = useTodayScreen();
  return today.session.week.days.find((day) => day.isToday)?.minutes ?? 0;
}

export function DayTime({ className }: { className?: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { today } = useTodayScreen();
  const time = getDayTime({ day: today.session, studied: useStudiedToday() });

  if (!time) {
    return null;
  }

  return (
    <BigQuantity className={className}>
      {time.kind === "studied"
        ? t("{time} studied", { time: formatDuration(time.minutes) })
        : t("{time} left", { time: formatDuration(time.minutes) })}
    </BigQuantity>
  );
}

export function DayMeta({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const speaking = useTodayContinueSpeaking();
  const { blocks, minutes, sessionBar } = today.session;

  if (blocks.length === 0 && minutes.left === 0) {
    return null;
  }

  return (
    <p
      className={cn(
        "text-muted-foreground hidden min-h-5 items-baseline gap-3 font-mono text-xs tabular-nums sm:flex",
        className,
      )}
      data-slot="today-day-meta"
    >
      {!speaking && sessionBar.total > 0 && (
        <span>
          {t(
            "{done, plural, =0 {# of {total, number} done} one {# of {total, number} done} other {# of {total, number} done}}",
            { done: sessionBar.completed, total: sessionBar.total },
          )}
        </span>
      )}
      <TodayContinueStatus className="ml-auto min-w-0 truncate text-right font-sans" />
      {!speaking && <DayTime className="text-foreground text-xl" />}
    </p>
  );
}
