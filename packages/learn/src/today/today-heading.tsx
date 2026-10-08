"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CalendarDaysIcon, HourglassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  PageEyebrow,
  PageHeader,
  PageHeaderContent,
  PageSubtitle,
  PageTitle,
} from "../_components/page";
import { PlanStatusLabel } from "../plan/plan-status-label";
import { useShortDayRange, useShortFocusName } from "../plan/use-short-plan";
import { useTodayScreen } from "./today-context";
import { useTodayDate } from "./use-today-copy";

/**
 * "34 days left" for a goal with a date ("About 292 days left" when the date is an estimate, until
 * the exam's notice is out); nothing for one without, whose date is the eyebrow.
 */
function DaysLeft() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { dateEstimated, daysLeft } = today.goal;

  if (daysLeft === null) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <HourglassIcon aria-hidden="true" className="size-4" />
      {dateEstimated
        ? t("{days, plural, one {About # day left} other {About # days left}}", { days: daysLeft })
        : t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", {
            days: daysLeft,
          })}
    </span>
  );
}

/** "Day 1 of 3 · Exam map and gaps": what today is for in a plan for a test days away. */
function ShortPlanLine({ short }: { short: NonNullable<TodayView["shortPlan"]> }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const dayRange = useShortDayRange();
  const focusName = useShortFocusName();
  const mocksRequirePlus = !today.session.examAccess.includesMockExams;

  return (
    <p className="flex items-start gap-2 text-sm font-medium">
      <LineMarker>
        <CalendarDaysIcon aria-hidden="true" className="text-muted-foreground size-4" />
      </LineMarker>
      {t("{days} · {focus}", {
        days: dayRange({ days: short.days, first: short.day, last: short.day }),
        focus: focusName(short.focus, { mocksRequirePlus }),
      })}
    </p>
  );
}

/**
 * One phrase beside the days left: where the plan stands ("1 day ahead of plan"), or, in a plan for
 * a test days away, what today is for. How prepared the learner is lives in the Journey.
 */
function TodayStatus() {
  const { today } = useTodayScreen();
  const status = today.progress?.status ?? null;

  if (today.shortPlan) {
    return <ShortPlanLine short={today.shortPlan} />;
  }

  return status ? (
    <PlanStatusLabel className="text-foreground text-[0.9375rem]" status={status} />
  ) : null;
}

/** The tab's name under today's date, with the days left and the plan's pace beside each other. */
export function TodayHeading() {
  const t = useExtracted();
  const date = useTodayDate();

  return (
    <PageHeader>
      <PageHeaderContent>
        <PageEyebrow>{date}</PageEyebrow>
        <PageTitle>{t("Today")}</PageTitle>
        <PageSubtitle className="empty:hidden">
          <DaysLeft />
          <TodayStatus />
        </PageSubtitle>
      </PageHeaderContent>
    </PageHeader>
  );
}
