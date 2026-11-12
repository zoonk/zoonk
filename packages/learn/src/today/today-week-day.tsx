"use client";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { cn } from "@zoonk/ui/lib/utils";
import { GraduationCapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { GoalRing, type GoalRingTrack } from "../_components/goal-ring";
import { KindIcon } from "../_components/kind-tile";
import { DoneMark } from "../_components/status-mark";
import { toLabelCase } from "../_utils/label-case";
import { useFormatDuration } from "../_utils/time-format";
import { type StudySession } from "../session/session-types";
import { useTodayScreen } from "./today-context";
import {
  type Challenge,
  getChallengeKind,
  useChallengeDayName,
  useWeekdayLabel,
} from "./today-week-challenge";

type WeekDay = StudySession["week"]["days"][number];

export const WEEK_DAY_SLOT = "today-week-day";

const DAY_BUTTON_CLASS =
  "flex min-h-11 w-full cursor-pointer flex-col items-center gap-1.5 rounded-md py-1 outline-none transition-colors hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/50";

const RING_CLASS = "size-7.5";

/** A day the plan gave no time that the learner studied anyway fills whole. */
function getDayShare(day: WeekDay): number {
  if (day.hitGoal) {
    return 1;
  }

  if (day.goalMinutes === 0) {
    return day.studied ? 1 : 0;
  }

  return Math.min(1, day.minutes / day.goalMinutes);
}

/** The week marks the current local day even while a lesson carries the previous day's session. */
function useWeekDate(): Date {
  const { today } = useTodayScreen();

  return today.session.week.days.find((day) => day.isToday)?.date ?? today.session.localDate;
}

function isMissed(day: WeekDay, localDate: Date): boolean {
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

function DayRing({ children, day }: { children?: React.ReactNode; day: WeekDay }) {
  const localDate = useWeekDate();

  if (isOutsidePlan(day) && !day.isToday) {
    return (
      <span aria-hidden="true" className={cn("flex items-center justify-center", RING_CLASS)}>
        <span className="bg-foreground/15 h-0.5 w-3 rounded-full" />
      </span>
    );
  }

  const isTarget = !day.studied && (day.kind === "exam" || day.kind === "deadline");

  return (
    <GoalRing className={RING_CLASS} share={getDayShare(day)} track={getTrack(day, localDate)}>
      {day.hitGoal && <DoneMark />}
      {isTarget && <GraduationCapIcon className="text-foreground" />}
      {!day.hitGoal && !isTarget && children}
    </GoalRing>
  );
}

function ChallengeDot({ challenge, day }: { challenge: Challenge; day: WeekDay }) {
  return (
    <DayRing day={day}>
      {getDayShare(day) === 0 && (
        <KindIcon className="size-3.5" kind={getChallengeKind(challenge)} />
      )}
    </DayRing>
  );
}

function DayLetter({ day }: { day: WeekDay }) {
  const format = useFormatter();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-faint font-mono text-[0.6875rem] uppercase",
        day.isToday && "text-foreground font-medium",
      )}
    >
      {format.dateTime(day.date, { timeZone: "UTC", weekday: "narrow" })}
    </span>
  );
}

function useDayStatus() {
  const t = useExtracted();
  const localDate = useWeekDate();
  const { today } = useTodayScreen();

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
      return today.goal.kind === "exam" ? t("after your exam") : t("after your end date");
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

function ChallengeDay({ challenge, day }: { challenge: Challenge; day: WeekDay }) {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const dayName = useChallengeDayName();
  const dayStatus = useDayStatus();
  const localDate = useWeekDate();
  const weekday = weekdayLabel(day.date);
  const status = dayStatus(day);
  const name = dayName(challenge);
  const ahead = day.date > localDate;

  return (
    <>
      <ChallengeDot challenge={challenge} day={day} />
      <DayLetter day={day} />
      <span className="sr-only">
        {ahead
          ? t("{day}: {name}", { day: weekday, name })
          : t("{day}: {name}, {status}", { day: weekday, name, status })}
      </span>
    </>
  );
}

function PlainDay({ day }: { day: WeekDay }) {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const dayStatus = useDayStatus();

  return (
    <>
      <DayRing day={day} />
      <DayLetter day={day} />
      <span className="sr-only">
        {t("{day}: {status}", { day: weekdayLabel(day.date), status: dayStatus(day) })}
      </span>
    </>
  );
}

function useDayTime() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (day: WeekDay): string | undefined => {
    if (day.minutes > 0) {
      return day.goalMinutes > 0
        ? t("{studied} of {planned} studied", {
            planned: formatDuration(day.goalMinutes),
            studied: formatDuration(day.minutes),
          })
        : t("{time} studied", { time: formatDuration(day.minutes) });
    }

    return day.goalMinutes > 0
      ? t("{time} planned", { time: formatDuration(day.goalMinutes) })
      : undefined;
  };
}

/** Only what the time line doesn't already say. */
function useDayNote() {
  const dayStatus = useDayStatus();
  const localDate = useWeekDate();

  return (day: WeekDay): string | undefined => {
    const saidByTime =
      !day.hitGoal &&
      (day.minutes > 0 ||
        (day.goalMinutes > 0 && day.kind === "study" && !isMissed(day, localDate)));

    return saidByTime ? undefined : toLabelCase(dayStatus(day));
  };
}

export function WeekDayCell({
  challenge,
  day,
  focusable,
}: {
  challenge: Challenge | null;
  day: WeekDay;
  focusable: boolean;
}) {
  const weekdayLabel = useWeekdayLabel();
  const dayName = useChallengeDayName();
  const dayTime = useDayTime();
  const dayNote = useDayNote();
  const time = dayTime(day);
  const note = dayNote(day);

  return (
    <Popover>
      <PopoverTrigger
        className={DAY_BUTTON_CLASS}
        data-slot={WEEK_DAY_SLOT}
        tabIndex={focusable ? 0 : -1}
      >
        {challenge ? <ChallengeDay challenge={challenge} day={day} /> : <PlainDay day={day} />}
      </PopoverTrigger>

      <PopoverContent className="w-56 gap-1.5 p-3" side="bottom">
        <PopoverHeader className="gap-0.5">
          <PopoverTitle>{weekdayLabel(day.date)}</PopoverTitle>
          {time && <p className="font-mono text-xs tabular-nums">{time}</p>}
          {note && <PopoverDescription className="text-xs">{note}</PopoverDescription>}
        </PopoverHeader>

        {challenge && (
          <p className="flex items-center gap-1.5 text-xs">
            <KindIcon className="size-3.5" kind={getChallengeKind(challenge)} />
            {toLabelCase(dayName(challenge))}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
