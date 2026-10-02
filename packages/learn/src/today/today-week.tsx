"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { type StudySession } from "../session/session-types";
import { useTodayScreen } from "./today-context";

type WeekDay = StudySession["week"]["days"][number];

const WEEK_TITLE_ID = "today-week-title";
const FULL_TURN_DEGREES = 360;

function isSameDay(a: Date, b: Date | null): boolean {
  return b !== null && a.getTime() === b.getTime();
}

/** How much of the day's goal was done, drawn as a filling pie. */
function getDayShare(day: WeekDay): number {
  if (day.hitGoal) {
    return 1;
  }

  return day.goalMinutes > 0 ? Math.min(1, day.minutes / day.goalMinutes) : 0;
}

function DayDot({ day, isChallengeDay }: { day: WeekDay; isChallengeDay: boolean }) {
  const share = getDayShare(day);
  const isRest = day.goalMinutes === 0 && !day.studied;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 items-center justify-center rounded-full sm:size-9",
        isRest ? "bg-muted/60" : "bg-muted",
        day.isToday && "ring-foreground ring-2 ring-offset-2 ring-offset-transparent",
      )}
      style={
        share > 0
          ? {
              background: `conic-gradient(var(--foreground) ${share * FULL_TURN_DEGREES}deg, var(--muted) 0deg)`,
            }
          : undefined
      }
    >
      {isChallengeDay && share === 0 && <FlagIcon className="text-muted-foreground size-3.5" />}
    </span>
  );
}

function useDayStatus() {
  const t = useExtracted();

  return (day: WeekDay): string => {
    if (day.hitGoal) {
      return t("goal reached");
    }

    if (day.studied) {
      return t("studied");
    }

    if (day.goalMinutes === 0) {
      return t("rest day");
    }

    return day.isToday ? t("today") : t("not studied");
  };
}

/**
 * The week as one row (the label and count above the days on phones): each day filled by how
 * much of its goal was done, today ringed, the week's checkpoint flagged. Every week starts fresh
 * on Monday, so nothing piles up.
 */
export function TodayWeek() {
  const t = useExtracted();
  const format = useFormatter();
  const dayStatus = useDayStatus();
  const { today } = useTodayScreen();
  const { week } = today.session;
  const challengeDate = today.weeklyChallenge?.date ?? null;

  return (
    <section
      aria-labelledby={WEEK_TITLE_ID}
      className="grid grid-cols-[1fr_auto] items-baseline gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-x-5"
    >
      <SectionLabel id={WEEK_TITLE_ID}>{t("This week")}</SectionLabel>
      <p className="text-muted-foreground text-right text-sm tabular-nums sm:order-last">
        {t("{done, number} of {total, plural, one {# day} other {# days}}", {
          done: week.daysHitGoal,
          total: week.studyDays,
        })}
      </p>

      <ol className="col-span-2 grid grid-cols-7 gap-1 sm:col-span-1">
        {week.days.map((day) => (
          <li className="flex flex-col items-center gap-1.5" key={day.date.toISOString()}>
            <span
              aria-hidden="true"
              className={cn(
                "text-muted-foreground text-xs",
                day.isToday && "text-foreground font-semibold",
              )}
            >
              {format.dateTime(day.date, { timeZone: "UTC", weekday: "narrow" })}
            </span>
            <DayDot day={day} isChallengeDay={isSameDay(day.date, challengeDate)} />
            <span className="sr-only">
              {t("{day}: {status}", {
                day: format.dateTime(day.date, { timeZone: "UTC", weekday: "long" }),
                status: dayStatus(day),
              })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
