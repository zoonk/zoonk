"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { GraduationCapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { BigQuantity } from "../_components/big-quantity";
import { GoalRing, type GoalRingTrack } from "../_components/goal-ring";
import { KindIcon } from "../_components/kind-tile";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { DoneMark } from "../_components/status-mark";
import { useFormatDuration } from "../_utils/time-format";
import { type StudySession } from "../session/session-types";
import { useTodayScreen } from "./today-context";
import {
  type Challenge,
  ChallengeRow,
  getChallengeKind,
  isSameDay,
  useChallengeDayName,
  useWeekdayLabel,
} from "./today-week-challenge";

type WeekDay = StudySession["week"]["days"][number];

const WEEK_TITLE_ID = "today-week-title";

const DAY_CELL_CLASS = "flex min-h-11 flex-col items-center gap-1.5 py-1";

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

  return (day: WeekDay): string => {
    if (day.hitGoal) {
      return t("goal reached");
    }

    if (day.studied) {
      return t("studied");
    }

    if (day.kind === "exam") {
      return t("exam day");
    }

    if (day.kind === "deadline") {
      return t("your goal's date");
    }

    if (day.kind === "beforeStart") {
      return t("before your plan");
    }

    if (day.kind === "afterEnd") {
      return t("after your date");
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

function ChallengeDay({
  challenge,
  day,
  status,
}: {
  challenge: Challenge;
  day: WeekDay;
  status: string;
}) {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const dayName = useChallengeDayName();
  const localDate = useWeekDate();
  const weekday = weekdayLabel(day.date);
  const name = dayName(challenge);
  const ahead = day.date > localDate;

  return (
    <span className={DAY_CELL_CLASS}>
      <ChallengeDot challenge={challenge} day={day} />
      <DayLetter day={day} />
      <span className="sr-only">
        {ahead
          ? t("{day}: {name}", { day: weekday, name })
          : t("{day}: {name}, {status}", { day: weekday, name, status })}
      </span>
    </span>
  );
}

function WeekTime({ className, size }: { className?: string; size: "headline" | "inline" }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { today } = useTodayScreen();
  const { studiedMinutes: studied, targetMinutes: planned } = today.session.week.time;

  if (planned === 0) {
    return null;
  }

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      <span aria-hidden="true">
        {size === "inline" && "· "}
        {size === "headline" ? (
          <BigQuantity className="text-2xl">{formatDuration(studied)}</BigQuantity>
        ) : (
          formatDuration(studied)
        )}
        <span className="text-muted-foreground text-xs">{` / ${formatDuration(planned)}`}</span>
      </span>
      <span className="sr-only">
        {t("{studied} of {planned} studied this week", {
          planned: formatDuration(planned),
          studied: formatDuration(studied),
        })}
      </span>
    </span>
  );
}

function WeekDetail() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { days } = today.session.week;
  const studyDays = days.filter((day) => day.kind === "study" || day.studied).length;
  const studied = days.filter((day) => day.studied).length;

  if (studyDays === 0) {
    return null;
  }

  return (
    <PageSectionDetail className="flex items-center gap-1.5">
      {t("{done, number} of {total, plural, one {# day} other {# days}}", {
        done: studied,
        total: studyDays,
      })}
      <WeekTime className="sm:hidden" size="inline" />
    </PageSectionDetail>
  );
}

export function TodayWeek({ className }: { className?: string }) {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const dayStatus = useDayStatus();
  const { today } = useTodayScreen();
  const challenge = today.weeklyChallenge;

  // A challenge in a later week waits for its week.
  const inWeek = today.session.week.days.some((day) =>
    isSameDay(day.date, challenge?.date ?? null),
  );

  return (
    <PageSection aria-labelledby={WEEK_TITLE_ID} className={className} data-slot="today-week">
      <PageSectionHeader>
        <PageSectionTitle id={WEEK_TITLE_ID}>{t("This week")}</PageSectionTitle>
        <WeekDetail />
      </PageSectionHeader>

      <WeekTime className="-mt-1 hidden sm:block" size="headline" />

      <div className="flex flex-col">
        <ol className="grid grid-cols-7 gap-1 py-1">
          {today.session.week.days.map((day) => (
            <li key={day.date.toISOString()}>
              {challenge && isSameDay(day.date, challenge.date) ? (
                <ChallengeDay challenge={challenge} day={day} status={dayStatus(day)} />
              ) : (
                <span className={DAY_CELL_CLASS}>
                  <DayRing day={day} />
                  <DayLetter day={day} />
                  <span className="sr-only">
                    {t("{day}: {status}", { day: weekdayLabel(day.date), status: dayStatus(day) })}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ol>

        {challenge?.date && inWeek && <ChallengeRow challenge={challenge} date={challenge.date} />}
      </div>
    </PageSection>
  );
}
