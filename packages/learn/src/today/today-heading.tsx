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
 * Drawn in the gap before a part: a part that wraps starts a new line, whose clipped edge hides its
 * dot.
 */
const SEPARATOR_CLASS = "relative before:absolute before:-left-3.5 before:content-['·']";

export function TodayEyebrowPart({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(SEPARATOR_CLASS, className)}>{children}</span>;
}

export function TodayEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <PageEyebrow className="flex flex-wrap items-center gap-x-5 overflow-hidden">
      {children}
    </PageEyebrow>
  );
}

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
 * Behind says so in a word before what to catch up; a return after a break says only "Behind",
 * since a big count above "Welcome back" read as a backlog.
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
 * A mock the learner's plan doesn't include wears the Plus mark, so the line never reads as a mock
 * they can take.
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

export function TodayHeading({ className }: { className?: string }) {
  const t = useExtracted();
  const date = useTodayDate();
  const state = useDayState();
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
