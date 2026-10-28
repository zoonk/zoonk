"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { BigQuantity } from "../_components/big-quantity";
import { METER_PARTS_CLASS } from "../_components/meter";
import { useFormatDuration } from "../_utils/time-format";
import { getBlockKind } from "../session/block-kind";
import { type DayStep } from "../session/session-types";
import { DaySegment, type DaySegmentState } from "./day-segments";
import { TodayContinueStatus, useTodayContinueSpeaking } from "./today-action";
import { useTodayScreen } from "./today-context";
import { isFinished } from "./today-queue";
import { useSessionState } from "./use-today-copy";

function getMinutesLeft(blocks: readonly DayStep[]): number {
  return blocks
    .filter((block) => !isFinished(block))
    .reduce((total, block) => total + block.estimatedMinutes, 0);
}

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
      className={cn(METER_PARTS_CLASS, className)}
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

/** The minutes actually studied, never the plan's minutes for the blocks done. */
export function useStudiedToday(): number {
  const { today } = useTodayScreen();
  return today.session.week.days.find((day) => day.isToday)?.minutes ?? 0;
}

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
