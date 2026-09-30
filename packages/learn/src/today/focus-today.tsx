"use client";

import { useExtracted } from "next-intl";
import { FocusSessionCard } from "./focus-session-card";
import { useTodayScreen } from "./today-context";
import { TodayExamAccess } from "./today-exam-access";
import { TodayExamMoment } from "./today-exam-moment";
import { TodayFreshStart } from "./today-fresh-start";
import { TodayInsight } from "./today-insight";
import { TodayShortPlan } from "./today-short-plan";
import { TodayStatusLine } from "./today-status-line";
import { TodaySuggestedGoal } from "./today-suggested-goal";
import { TodayWeek } from "./today-week";
import { TodayWeeklyChallenge } from "./today-weekly-challenge";
import { useTodayDate } from "./use-today-copy";

function FocusTodayHeading() {
  const t = useExtracted();
  const date = useTodayDate();
  const { today } = useTodayScreen();
  const { daysLeft } = today.goal;

  if (daysLeft === null) {
    return <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{date}</h1>;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">{date}</p>
      <h1 className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
        {t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", {
          days: daysLeft,
        })}
      </h1>
    </>
  );
}

/**
 * Focus Today: the date and days left, one status line, the session card with one Continue, the
 * week as one row and at most one insight. Everything else waits in the tabs.
 */
export function FocusToday() {
  return (
    <div className="flex flex-col gap-6" data-slot="focus-today">
      <header className="flex flex-col gap-1.5">
        <FocusTodayHeading />
        <TodayStatusLine className="mt-1" />
        <TodayShortPlan className="mt-1" />
      </header>

      <TodayFreshStart />
      <TodayExamMoment />
      <TodayExamAccess />
      <FocusSessionCard />

      <div className="flex flex-col gap-3">
        <TodayWeek />
        <TodayWeeklyChallenge />
      </div>

      <TodayInsight />
      <TodaySuggestedGoal />
    </div>
  );
}
