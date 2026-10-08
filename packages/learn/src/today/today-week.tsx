"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, GraduationCapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { PlusMark } from "../_components/plus-lock";
import { Surface } from "../_components/surface";
import { toLabelCase } from "../_utils/label-case";
import { useFormatDuration } from "../_utils/time-format";
import { type StudySession } from "../session/session-types";
import { useTodayScreen } from "./today-context";

type WeekDay = StudySession["week"]["days"][number];
type Challenge = NonNullable<TodayView["weeklyChallenge"]>;

const WEEK_TITLE_ID = "today-week-title";
const FULL_TURN_DEGREES = 360;

const DAY_CELL_CLASS = "flex min-h-11 flex-col items-center gap-1.5 rounded-xl py-1.5";

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

/** A study day already past without study: a dashed ring, never a red mark. */
function isMissed(day: WeekDay, localDate: Date): boolean {
  return day.kind === "study" && !day.studied && !day.isToday && day.date < localDate;
}

/**
 * A day's dot: a filled disc with a check once its goal is reached, a pie of how much of it was
 * done, a dashed ring for a study day missed, a thick ring for today, a soft disc for a day ahead
 * (fainter on a rest day), an empty ring outside the plan. The exam's day (or the goal's date)
 * carries a cap.
 */
function getDayDotClass(day: WeekDay, localDate: Date): string {
  if (day.hitGoal) {
    return "bg-foreground text-background";
  }

  if (day.isToday) {
    return "border-foreground border-[3px]";
  }

  if (isMissed(day, localDate)) {
    return "border-foreground/20 border-2 border-dashed";
  }

  if (day.kind === "beforeStart" || day.kind === "afterEnd") {
    return "border-border border";
  }

  if (day.kind === "rest") {
    return "bg-foreground/4 dark:bg-white/5";
  }

  return "bg-foreground/10 text-foreground";
}

function DayDot({ day }: { day: WeekDay }) {
  const { today } = useTodayScreen();
  const share = getDayShare(day);
  const isTarget = !day.studied && (day.kind === "exam" || day.kind === "deadline");
  const partial = share > 0 && !day.hitGoal;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 items-center justify-center rounded-full [&>svg]:size-4",
        getDayDotClass(day, today.session.localDate),
      )}
      style={
        partial
          ? {
              background: `conic-gradient(var(--foreground) ${share * FULL_TURN_DEGREES}deg, color-mix(in oklab, var(--foreground) 10%, transparent) 0deg)`,
            }
          : undefined
      }
    >
      {day.hitGoal && <CheckIcon strokeWidth={3} />}
      {isTarget && <GraduationCapIcon />}
    </span>
  );
}

/** The challenge's day, flagged in its kind's color until study fills it. */
function ChallengeDot({ challenge, day }: { challenge: Challenge; day: WeekDay }) {
  if (getDayShare(day) > 0) {
    return <DayDot day={day} />;
  }

  return (
    <KindTile
      className={cn(
        "size-9 rounded-full",
        day.isToday && "ring-foreground ring-2 ring-offset-2 ring-offset-transparent",
      )}
      kind={challenge.kind === "mock" ? "mock" : "challenge"}
      size="sm"
    />
  );
}

function DayLetter({ day }: { day: WeekDay }) {
  const format = useFormatter();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-muted-foreground text-xs font-semibold",
        day.isToday && "text-foreground",
      )}
    >
      {format.dateTime(day.date, { timeZone: "UTC", weekday: "narrow" })}
    </span>
  );
}

/** What a day of the week was, or will be: a day still ahead is never "not studied". */
function useDayStatus() {
  const t = useExtracted();
  const { today } = useTodayScreen();

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
      return t("after your plan");
    }

    if (day.kind === "rest") {
      return t("rest day");
    }

    if (day.isToday) {
      return t("today");
    }

    return day.date > today.session.localDate ? t("planned") : t("not studied");
  };
}

/** "Thursday", as a label starts. */
function useWeekdayLabel() {
  const format = useFormatter();
  return (date: Date) => toLabelCase(format.dateTime(date, { timeZone: "UTC", weekday: "long" }));
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
  const { today } = useTodayScreen();
  const weekday = weekdayLabel(day.date);
  const name = challenge.kind === "mock" ? t("mock exam") : t("weekly challenge");
  const ahead = day.date > today.session.localDate;

  return (
    <span className={DAY_CELL_CLASS}>
      <DayLetter day={day} />
      <ChallengeDot challenge={challenge} day={day} />
      <span className="sr-only">
        {ahead
          ? t("{day}: {name}", { day: weekday, name })
          : t("{day}: {name}, {status}", { day: weekday, name, status })}
      </span>
    </span>
  );
}

/**
 * The week's challenge under the days: its name, then its day, questions and time; the row opens
 * its intro.
 */
function ChallengeRow({ challenge, date }: { challenge: Challenge; date: Date }) {
  const t = useExtracted();
  const format = useFormatter();
  const formatDuration = useFormatDuration();
  const weekdayLabel = useWeekdayLabel();
  const { actions, today } = useTodayScreen();
  const name = challenge.kind === "mock" ? t("Mock exam") : t("Weekly challenge");

  // A challenge in a later week names its date too, so "Sunday" never reads as this one.
  const inWeek = today.session.week.days.some((day) => isSameDay(day.date, date));

  const day = inWeek
    ? weekdayLabel(date)
    : `${weekdayLabel(date)}, ${format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC" })}`;

  const facts = [
    day,
    challenge.questions > 0 &&
      t("{count, plural, one {# question} other {# questions}}", { count: challenge.questions }),
    challenge.timeLimitMinutes !== null && formatDuration(challenge.timeLimitMinutes),
  ].filter(Boolean);

  return (
    <ListRowLink className="border-t" href={actions.challengeHref(challenge.planItemId)}>
      <ListRowLeading>
        <KindTile kind={challenge.kind === "mock" ? "mock" : "challenge"} size="sm" />
      </ListRowLeading>
      <ListRowContent className="min-h-13 py-2.5">
        <ListRowTitle>{name}</ListRowTitle>
        <ListRowDescription>{facts.join(" · ")}</ListRowDescription>
      </ListRowContent>
      {challenge.access === "plusRequired" && (
        <ListRowTrailing>
          <PlusMark />
        </ListRowTrailing>
      )}
    </ListRowLink>
  );
}

/** "1 of 6 days": the week's study days the learner studied so far. */
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
    <PageSectionDetail>
      {t("{done, number} of {total, plural, one {# day} other {# days}}", {
        done: studied,
        total: studyDays,
      })}
    </PageSectionDetail>
  );
}

/**
 * The week under its header, as one row of days, each filled by how much of its goal was done,
 * today ringed. The day of the week's challenge (or mock exam) carries a flag that opens it, and
 * the challenge is named under the days. Every week starts fresh on Monday, so nothing piles up.
 */
export function TodayWeek() {
  const t = useExtracted();
  const weekdayLabel = useWeekdayLabel();
  const dayStatus = useDayStatus();
  const { today } = useTodayScreen();
  const challenge = today.weeklyChallenge;

  return (
    <PageSection aria-labelledby={WEEK_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={WEEK_TITLE_ID}>{t("This week")}</PageSectionTitle>
        <WeekDetail />
      </PageSectionHeader>

      <Surface className="overflow-hidden">
        <ol className="grid grid-cols-7 gap-1 px-2 py-4 sm:px-3">
          {today.session.week.days.map((day) => (
            <li key={day.date.toISOString()}>
              {challenge && isSameDay(day.date, challenge.date) ? (
                <ChallengeDay challenge={challenge} day={day} status={dayStatus(day)} />
              ) : (
                <span className={DAY_CELL_CLASS}>
                  <DayLetter day={day} />
                  <DayDot day={day} />
                  <span className="sr-only">
                    {t("{day}: {status}", { day: weekdayLabel(day.date), status: dayStatus(day) })}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ol>

        {challenge?.date && <ChallengeRow challenge={challenge} date={challenge.date} />}
      </Surface>
    </PageSection>
  );
}
