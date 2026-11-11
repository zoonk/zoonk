"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { BigQuantity } from "../_components/big-quantity";
import { useFormatDuration } from "../_utils/time-format";
import { getDayMeterParts } from "../session/day-meter-parts";
import { getSessionQueue } from "../session/session-queue-rows";
import { type DayStep } from "../session/session-types";
import { DayMeter } from "./day-segments";
import { TodayContinueStatus, useTodayContinueSpeaking } from "./today-action";
import { useTodayScreen } from "./today-context";
import { getDayTime, getHeldMinutes } from "./today-time";

function getBlockShare(block: DayStep): number {
  if (block.status !== "active" || block.questions === 0) {
    return 0;
  }

  return Math.min(1, block.answered / block.questions);
}

export function DayProgress({ className }: { className?: string }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks, nextPosition, sessionBar } = today.session;
  const rows = getSessionQueue({ blocks, nextPosition });
  const next = blocks.find((block) => block.position === nextPosition);

  return (
    <DayMeter
      className={className}
      held={getHeldMinutes(today.session) > 0}
      label={t(
        "{done, plural, =0 {# of {total, number} done} one {# of {total, number} done} other {# of {total, number} done}}",
        { done: sessionBar.completed, total: sessionBar.total },
      )}
      parts={getDayMeterParts({ nextShare: next ? getBlockShare(next) : 0, rows })}
    />
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
