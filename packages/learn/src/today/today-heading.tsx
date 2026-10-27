"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  PageEyebrow,
  PageHeader,
  PageHeaderContent,
  PageSubtitle,
  PageTitle,
} from "../_components/page";
import { PlusMark } from "../_components/plus-lock";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanStatusText } from "../plan/plan-status-label";
import { useShortDayRange, useShortFocusName } from "../plan/use-short-plan";
import { useTodayScreen } from "./today-context";
import { DayTime } from "./today-day-progress";
import { isWelcomeBackDay, useDayState, useTodayDate } from "./use-today-copy";

/**
 * The dot between the parts of the date line, drawn in the gap before a part: a part that wraps to
 * a new line starts it, so the line's clipped edge hides its dot.
 */
const SEPARATOR_CLASS = "relative before:absolute before:-left-3.5 before:content-['·']";

/** One part of the date line after the date, behind its dot. */
export function TodayEyebrowPart({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(SEPARATOR_CLASS, className)}>{children}</span>;
}

/**
 * The quiet line over Today's title, its parts behind dots: the date, the days left, and where the
 * day or the plan stands.
 */
export function TodayEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <PageEyebrow className="flex flex-wrap items-center gap-x-5 overflow-hidden">
      {children}
    </PageEyebrow>
  );
}

/**
 * "34 days left" for a goal with a date ("~292 days left" when the date is an estimate, until the
 * exam's notice is out); nothing for one without.
 */
function DaysLeft() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { dateEstimated, daysLeft } = today.goal;

  if (daysLeft === null) {
    return null;
  }

  return (
    <TodayEyebrowPart>
      {dateEstimated
        ? t("{days, plural, one {~# day left} other {~# days left}}", { days: daysLeft })
        : t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", {
            days: daysLeft,
          })}
    </TodayEyebrowPart>
  );
}

/**
 * Where the plan stands ("Keeping pace", "One day ahead"), in the line's own quiet tone: only a
 * plan that no longer fits takes color, on its words. Behind says so in a word before what to
 * catch up ("Behind · 17 lessons to catch up"): Will read "17 lessons pending" as a to-do list,
 * not as being behind. A return after a break says only "Behind": "377 lessons to catch up" above
 * "Welcome back! Today is lighter" read as a backlog to clear, and the Plan has the count. Being
 * behind is never an alarm.
 */
function TodayPace() {
  const t = useExtracted();
  const statusText = usePlanStatusText();
  const { today } = useTodayScreen();
  const status = today.progress?.status ?? null;

  if (!status || today.shortPlan) {
    return null;
  }

  if (status.kind === "behind" && isWelcomeBackDay(today.session)) {
    return <TodayEyebrowPart>{t("Behind")}</TodayEyebrowPart>;
  }

  // "2 days behind" says it already; a count to catch up says it after "Behind".
  if (status.kind === "behind" && status.lessons) {
    return (
      <>
        <TodayEyebrowPart>{t("Behind")}</TodayEyebrowPart>
        <TodayEyebrowPart>{statusText(status)}</TodayEyebrowPart>
      </>
    );
  }

  return (
    <TodayEyebrowPart
      className={cn(status.kind === "needsAdjusting" && "text-destructive-text font-medium")}
    >
      {statusText(status)}
    </TodayEyebrowPart>
  );
}

/** "Day 1 of 3 · Exam map and gaps": what today is for in a plan for a test days away. */
function ShortPlanPart() {
  const dayRange = useShortDayRange();
  const focusName = useShortFocusName();
  const { today } = useTodayScreen();
  const short = today.shortPlan;

  if (!short) {
    return null;
  }

  return (
    <>
      <TodayEyebrowPart>
        {dayRange({ days: short.days, first: short.day, last: short.day })}
      </TodayEyebrowPart>
      <TodayEyebrowPart>
        {focusName(short.focus, { mocksRequirePlus: !today.session.examAccess.includesMockExams })}
      </TodayEyebrowPart>
    </>
  );
}

/** The exam's own days, said where the date is: "ENEM tomorrow", "ENEM today". */
function ExamDayPart() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { exam } = today;

  if (exam?.stage === "dayBefore") {
    return <TodayEyebrowPart>{t("{exam} tomorrow", { exam: exam.examName })}</TodayEyebrowPart>;
  }

  if (exam?.stage === "examDay") {
    return <TodayEyebrowPart>{t("{exam} today", { exam: exam.examName })}</TodayEyebrowPart>;
  }

  return null;
}

/**
 * Why a study day is lighter than the learner's time: it sets some aside for a mock exam longer
 * than their day, which the Plan shows at its real length on its date. A sentence, so it's the
 * title's supporting line rather than a part of the quiet uppercase line over it. A return after a
 * break already says its day is lighter (see `useFreshStartText`), so it only names the mock. Every
 * plan saves that time; a mock the learner's plan doesn't include wears the Plus mark beside its
 * words, so the line never reads as a mock they can take.
 */
function MockFundingLine() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { today } = useTodayScreen();

  if (!today.mockFunding) {
    return null;
  }

  const date = formatDate(today.mockFunding.mockDate);

  return (
    <PageSubtitle className="gap-x-2">
      <span>
        {isWelcomeBackDay(today.session)
          ? t("Saving time for {date}'s mock exam", { date })
          : t("Lighter day: saving time for {date}'s mock exam", { date })}
      </span>
      {!today.session.examAccess.includesMockExams && <PlusMark />}
    </PageSubtitle>
  );
}

/**
 * The tab's name under one quiet line (the date, the days left, where the plan stands, every day:
 * a finished or rest day says so under the title, and where the learner stands still matters),
 * and on a phone the day's time beside it as a readout ("44 min left"); from `sm` that time moves
 * under the day's segments and the day's action takes its place beside the title. A day lighter
 * for a mock says why under the title.
 */
export function TodayHeading({ className }: { className?: string }) {
  const t = useExtracted();
  const date = useTodayDate();
  const state = useDayState();
  // A finished or rest day has no lighter session left to explain.
  const endsDay = state === "done" || state === "rest";

  return (
    <PageHeader className={className}>
      <PageHeaderContent className="w-full">
        <TodayEyebrow>
          <span>{date}</span>
          <DaysLeft />
          <ShortPlanPart />
          <ExamDayPart />
          <TodayPace />
        </TodayEyebrow>

        <div className="flex items-baseline justify-between gap-3">
          <PageTitle>{t("Today")}</PageTitle>
          <DayTime className="shrink-0 text-2xl sm:hidden" />
        </div>

        {!endsDay && <MockFundingLine />}
      </PageHeaderContent>
    </PageHeader>
  );
}
