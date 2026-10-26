"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { BigQuantity } from "../_components/big-quantity";
import { useFormatDuration } from "../_utils/time-format";
import { getBlockKind } from "../session/block-kind";
import { type DayStep } from "../session/session-types";
import { DAY_SEGMENTS_CLASS, DaySegment, type DaySegmentState } from "./day-segments";
import { TodayContinueStatus, useTodayContinueSpeaking } from "./today-action";
import { useTodayScreen } from "./today-context";
import { isFinished } from "./today-queue";
import { useSessionState } from "./use-today-copy";

/** The minutes the day's blocks still hold. */
function getMinutesLeft(blocks: readonly DayStep[]): number {
  return blocks
    .filter((block) => !isFinished(block))
    .reduce((total, block) => total + block.estimatedMinutes, 0);
}

/** How far the block in progress is, by its questions answered; nothing before it starts. */
function getBlockShare(block: DayStep): number {
  if (block.status !== "active" || block.questions === 0) {
    return 0;
  }

  return Math.min(1, block.answered / block.questions);
}

/** Where a block stands on the day's bar: behind the learner, in progress, or ahead. */
function getSegmentState(block: DayStep, current: boolean): DaySegmentState {
  if (block.status === "completed") {
    return "done";
  }

  if (block.status === "skipped") {
    return "skipped";
  }

  return current ? "current" : "ahead";
}

/**
 * The day at a glance under Today's title, a meter of its blocks: one segment per block, as long as
 * its minutes, done in blue, the one in progress ringed in blue and the rest ahead on the track, a
 * block that isn't a lesson tinted in its kind's hue (see `DaySegment`). Screen readers hear how
 * far along the day is.
 */
export function DayProgress({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks, nextPosition } = today.session;
  const done = blocks.filter((block) => isFinished(block)).length;

  if (blocks.length < 2) {
    return null;
  }

  return (
    <div
      aria-label={t(
        "{done, plural, =0 {# of {total, number} done} one {# of {total, number} done} other {# of {total, number} done}}",
        { done, total: blocks.length },
      )}
      className={cn(DAY_SEGMENTS_CLASS, className)}
      data-slot="today-day-progress"
      role="img"
    >
      {blocks.map((block) => (
        <DaySegment
          key={block.position}
          kind={getBlockKind(block)}
          minutes={block.estimatedMinutes}
          share={block.position === nextPosition ? getBlockShare(block) : 0}
          state={getSegmentState(block, block.position === nextPosition)}
        />
      ))}
    </div>
  );
}

/**
 * The minutes the learner actually studied today, as the week and the session's summary count them:
 * never the plan's minutes for the blocks done ("54 min studied" after a 14-minute session).
 */
export function useStudiedToday(): number {
  const { today } = useTodayScreen();
  return today.session.week.days.find((day) => day.isToday)?.minutes ?? 0;
}

/**
 * The day's time beside its blocks, as a readout (its numbers large, its words small and muted):
 * what's left while there's a block to do ("44 min left"), what was studied once the day is done
 * ("45 min studied"). Nothing while the day waits. Size it with `className`.
 */
export function DayTime({ className }: { className?: string }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { today } = useTodayScreen();
  const { done, limitReached, waiting } = useSessionState();
  const studied = useStudiedToday();
  const left = getMinutesLeft(today.session.blocks);

  if (waiting) {
    return null;
  }

  if (done || limitReached) {
    return studied > 0 ? (
      <BigQuantity className={className}>
        {t("{time} studied", { time: formatDuration(studied) })}
      </BigQuantity>
    ) : null;
  }

  if (left === 0) {
    return null;
  }

  return (
    <BigQuantity className={className}>
      {t("{time} left", { time: formatDuration(left) })}
    </BigQuantity>
  );
}

/**
 * The line under the day's segments, from `sm`: how many blocks are done, quiet in the mono face,
 * and the day's time as a readout at its end ("1 of 7 done · 44 min left"), right under the
 * title's action. While a slow or failed Start says how it's going, that takes the whole line,
 * on one line so the day never moves.
 */
export function DayMeta({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const speaking = useTodayContinueSpeaking();
  const { blocks } = today.session;
  const done = blocks.filter((block) => isFinished(block)).length;

  if (blocks.length === 0) {
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
      {!speaking && (
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
