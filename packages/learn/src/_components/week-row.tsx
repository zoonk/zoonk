"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { GraduationCapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatWeekday } from "../_utils/iso-date";
import { type StudySession } from "../session/session-types";
import { GOAL_RING_SIZE_CLASS, GoalRing, type GoalRingTrack } from "./goal-ring";
import { DoneMark } from "./status-mark";

type WeekDay = StudySession["week"]["days"][number];

/** A week's seven days across the column, Monday first as the plan's week runs. */
export const WEEK_ROW_CLASS = "flex w-full justify-between";

/** A day of the row: its ring, then its letter under it. */
export const WEEK_DAY_CLASS = "flex flex-col items-center gap-1.5";

const DAY_LETTER_CLASS = "text-2xs font-mono uppercase";

/** The day's letter under its ring; today's is the one that stands out. */
export function WeekDayLetter({ date, isToday }: { date: Date; isToday: boolean }) {
  const formatWeekday = useFormatWeekday();

  return (
    <span
      aria-hidden="true"
      className={cn(DAY_LETTER_CLASS, isToday ? "text-foreground font-medium" : "text-faint")}
      data-slot="week-day-letter"
    >
      {formatWeekday(date, "narrow")}
    </span>
  );
}

/** A letter's room while the week loads. */
export function WeekDayLetterSkeleton() {
  return <span className={DAY_LETTER_CLASS}>{"\u00A0"}</span>;
}

/**
 * The day's list as far as it's done; a finished list, or study on a day without one, is full. Extra
 * work never counts, so it can't lower a day.
 */
export function getDayShare(day: Pick<WeekDay, "completed" | "hitGoal" | "total">): number {
  if (day.hitGoal) {
    return 1;
  }

  return day.total > 0 ? day.completed / day.total : 0;
}

export function isMissed(day: WeekDay, localDate: Date): boolean {
  return day.kind === "study" && !day.studied && !day.isToday && day.date < localDate;
}

function isOutsidePlan(day: WeekDay): boolean {
  return !day.studied && (day.kind === "beforeStart" || day.kind === "afterEnd");
}

function getTrack(day: WeekDay, localDate: Date): GoalRingTrack {
  if (day.isToday) {
    return "today";
  }

  if (isMissed(day, localDate)) {
    return "missed";
  }

  return day.kind === "rest" ? "rest" : "default";
}

/** What a day says to a screen reader, on Today's week and the plan's alike. */
export function useWeekDayStatus({ examGoal, localDate }: { examGoal: boolean; localDate: Date }) {
  const t = useExtracted();

  return (day: WeekDay): string => {
    if (day.hitGoal) {
      return t("done");
    }

    if (day.studied) {
      return t("studied");
    }

    if (day.kind === "exam") {
      return t("exam day");
    }

    if (day.kind === "deadline") {
      return t("end date");
    }

    if (day.kind === "beforeStart") {
      return t("before your plan");
    }

    if (day.kind === "afterEnd") {
      return examGoal ? t("after your exam") : t("after your end date");
    }

    if (day.kind === "rest") {
      return t("rest day");
    }

    if (day.isToday) {
      return t("today");
    }

    return day.date > localDate ? t("planned") : t("not studied");
  };
}

export function WeekDayRing({
  children,
  day,
  localDate,
}: {
  children?: React.ReactNode;
  day: WeekDay;
  localDate: Date;
}) {
  if (isOutsidePlan(day) && !day.isToday) {
    return (
      <span
        aria-hidden="true"
        className={cn("flex items-center justify-center", GOAL_RING_SIZE_CLASS)}
      >
        <span className="bg-foreground/15 h-0.5 w-3 rounded-full" />
      </span>
    );
  }

  const isTarget = !day.studied && (day.kind === "exam" || day.kind === "deadline");

  return (
    <GoalRing share={getDayShare(day)} track={getTrack(day, localDate)}>
      {day.hitGoal && <DoneMark />}
      {isTarget && <GraduationCapIcon className="text-foreground" />}
      {!day.hitGoal && !isTarget && children}
    </GoalRing>
  );
}
