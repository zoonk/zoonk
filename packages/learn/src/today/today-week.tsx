"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { GraduationCapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
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

/** Today's rings: 30px, the letter under each one. */
const RING_CLASS = "size-7.5";

/** How much of the day's goal was done, drawn as the ring's arc. */
function getDayShare(day: WeekDay): number {
  if (day.hitGoal) {
    return 1;
  }

  return day.goalMinutes > 0 ? Math.min(1, day.minutes / day.goalMinutes) : 0;
}

/** The week marks the current local day even while a lesson carries the previous day's session. */
function useWeekDate(): Date {
  const { today } = useTodayScreen();

  return today.session.week.days.find((day) => day.isToday)?.date ?? today.session.localDate;
}

/** A study day already past without study: a dashed ring, never a red mark. */
function isMissed(day: WeekDay, localDate: Date): boolean {
  return day.kind === "study" && !day.studied && !day.isToday && day.date < localDate;
}

/**
 * A day before the plan started or after its date: no study was asked, so nothing to fill. Past
 * the date nothing is planned until the learner moves it, though the plan goes on (see
 * `PlanStatus` `pastDate`).
 */
function isOutsidePlan(day: WeekDay): boolean {
  return !day.studied && (day.kind === "beforeStart" || day.kind === "afterEnd");
}

/**
 * The ring's track: darker for today, dashed for a study day missed, faint for a rest day, so the
 * week reads at a glance without a single red mark.
 */
function getTrack(day: WeekDay, localDate: Date): GoalRingTrack {
  if (day.isToday) {
    return "today";
  }

  if (isMissed(day, localDate)) {
    return "missed";
  }

  return day.kind === "rest" ? "rest" : "default";
}

/**
 * A day as a small activity ring: its arc fills with how much of the day's goal was done and
 * closes with a check once reached. A day outside the plan is only a short dash, so days before it
 * started never read as missed. The exam's day (or the goal's date) carries a cap; a challenge's
 * day carries its kind's icon.
 */
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

/** The challenge's day: its ring with the challenge's icon in its kind's color until it's filled. */
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

/** What a day of the week was, or will be: a day still ahead is never "not studied". */
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

    // Plans don't end: past its date a plan with lessons left goes on once the learner moves it,
    // so the day is said by the date. Lucas's week read "after your plan" over 13 lessons left.
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

/**
 * The challenge's day, flagged in its kind's color, says what it is once ("Thursday: mock exam",
 * and how the day went once it's here). The row under the days, by name, opens its intro, so the
 * day itself isn't a second way to the same place.
 */
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

/**
 * "1 min / 4 hr 30 min": the week's time studied over what the plan gives it, in the mono face;
 * screen readers hear it as a sentence.
 */
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
        <span className={cn(size === "headline" && "text-[1.375rem] leading-7 font-medium")}>
          {formatDuration(studied)}
        </span>
        <span className="text-muted-foreground">{` / ${formatDuration(planned)}`}</span>
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

/**
 * "1 of 6 days": the week's study days the learner studied so far; on a phone the week's time
 * joins it, where a tablet or a computer shows it as the block's number.
 */
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

/**
 * The week under its header, as one row of days, each a ring filled by how much of its goal was
 * done. The day of the week's challenge (or mock exam) carries a flag that opens it, and
 * the challenge is named under the days when it falls this week. Every week starts fresh on Monday,
 * so nothing piles up.
 */
export function TodayWeek({ className }: { className?: string }) {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const dayStatus = useDayStatus();
  const { today } = useTodayScreen();
  const challenge = today.weeklyChallenge;

  // A challenge in a later week waits for its week: "This week" named next Sunday's mock (the
  // exam page and the Plan say when the next one is).
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
