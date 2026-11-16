"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { GraduationCapIcon } from "lucide-react";
import { useFormatWeekday } from "../_utils/iso-date";
import { type StudySession } from "../session/session-types";
import { GoalRing, type GoalRingTrack } from "./goal-ring";
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

/** A day the plan gave no time that the learner studied anyway fills whole. */
export function getDayShare(day: WeekDay): number {
  if (day.hitGoal) {
    return 1;
  }

  if (day.goalMinutes === 0) {
    return day.studied ? 1 : 0;
  }

  return Math.min(1, day.minutes / day.goalMinutes);
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

export function WeekDayRing({
  children,
  day,
  localDate,
  className,
}: {
  children?: React.ReactNode;
  day: WeekDay;
  localDate: Date;
  className?: string;
}) {
  if (isOutsidePlan(day) && !day.isToday) {
    return (
      <span aria-hidden="true" className={cn("flex size-9 items-center justify-center", className)}>
        <span className="bg-foreground/15 h-0.5 w-3 rounded-full" />
      </span>
    );
  }

  const done = day.hitGoal || (day.studied && day.goalMinutes === 0);
  const isTarget = !day.studied && (day.kind === "exam" || day.kind === "deadline");

  return (
    <GoalRing className={className} share={getDayShare(day)} track={getTrack(day, localDate)}>
      {done && <DoneMark />}
      {isTarget && <GraduationCapIcon className="text-foreground" />}
      {!done && !isTarget && children}
    </GoalRing>
  );
}
