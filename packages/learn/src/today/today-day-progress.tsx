"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { BigQuantity } from "../_components/big-quantity";
import { METER_PARTS_CLASS } from "../_components/meter";
import { moveFocusWithArrows } from "../_utils/arrow-focus";
import { useFormatDuration } from "../_utils/time-format";
import { type DayStep } from "../session/session-types";
import { type DaySegmentState } from "./day-segments";
import { TodayContinueStatus, useTodayContinueSpeaking } from "./today-action";
import { useTodayScreen } from "./today-context";
import { isFinished } from "./today-queue";
import { BlockSegment, DAY_SEGMENT_SLOT, HeldSegment } from "./today-segment-popover";
import { getDaySegmentCount, getDayTime, getHeldMinutes } from "./today-time";

function getBlockShare(block: DayStep): number {
  if (block.status !== "active" || block.questions === 0) {
    return 0;
  }

  return Math.min(1, block.answered / block.questions);
}

function getSegmentState(block: DayStep, current: boolean): DaySegmentState {
  if (block.status === "completed") {
    return "done";
  }

  if (block.status === "skipped") {
    return "skipped";
  }

  return current ? "current" : "ahead";
}

const moveBetweenSegments = moveFocusWithArrows(DAY_SEGMENT_SLOT);

export function DayProgress({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks, nextPosition } = today.session;
  const done = blocks.filter((block) => isFinished(block)).length;
  const held = getHeldMinutes(today.session);
  const focusPosition = nextPosition ?? blocks[0]?.position;

  if (getDaySegmentCount(today.session) < 2) {
    return null;
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The arrow keys move between the buttons inside.
    <div
      aria-label={t(
        "{done, plural, =0 {# of {total, number} done} one {# of {total, number} done} other {# of {total, number} done}}",
        { done, total: blocks.length },
      )}
      className={cn(METER_PARTS_CLASS, className)}
      data-slot="today-day-progress"
      onKeyDown={moveBetweenSegments}
      role="group"
    >
      {blocks.map((block) => (
        <BlockSegment
          block={block}
          focusable={block.position === focusPosition}
          key={block.position}
          share={block.position === nextPosition ? getBlockShare(block) : 0}
          state={getSegmentState(block, block.position === nextPosition)}
        />
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
  const { blocks, minutes } = today.session;
  const done = blocks.filter((block) => isFinished(block)).length;

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
      {!speaking && blocks.length > 0 && (
        <span>
          {t(
            "{done, plural, =0 {# of {total, number} done} one {# of {total, number} done} other {# of {total, number} done}}",
            { done, total: blocks.length },
          )}
        </span>
      )}
      <TodayContinueStatus className="ml-auto min-w-0 truncate text-right font-sans" />
      {!speaking && <DayTime className="text-foreground text-xl" />}
    </p>
  );
}
