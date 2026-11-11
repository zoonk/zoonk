"use client";

import { CountUp } from "@zoonk/ui/components/count-up";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { useExtracted, useFormatter } from "next-intl";
import { BigQuantity } from "../../_components/big-quantity";
import { daysUntilIsoDate, isoDateToUtc, useFormatIsoDate } from "../../_utils/iso-date";
import { useAppLocale } from "../../_utils/locale";
import { useFormatDuration } from "../../_utils/time-format";
import { usePlanScreen } from "../../plan/plan-context";
import { useStudyDaysText } from "../../plan/use-study-days-text";
import { useRevealPhases } from "./plan-shape";
import { getAimAhead } from "./schedule-aim";

const READOUT_CLASS = "text-readout text-2xl leading-tight";

function Readout({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 py-3 ps-3 first:ps-0 sm:ps-4">
      <span className={READOUT_CLASS}>{children}</span>
      <span className="text-muted-foreground text-xs leading-snug text-pretty">{label}</span>
    </div>
  );
}

function useTimeLabel(): string {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const studyDaysText = useStudyDaysText();
  const { plan } = usePlanScreen();
  const { shape, weekdayMinutes } = plan.schedule;

  if (shape.weekend !== null) {
    return t("{time} on weekends", { time: formatDuration(shape.weekend) });
  }

  return weekdayMinutes.every((minutes) => minutes > 0)
    ? t("a day")
    : studyDaysText(weekdayMinutes);
}

function TimeReadout() {
  const formatDuration = useFormatDuration();
  const label = useTimeLabel();
  const { plan } = usePlanScreen();
  const { shape } = plan.schedule;

  return (
    <Readout label={label}>
      <BigQuantity>{formatDuration(shape.weekdays)}</BigQuantity>
    </Readout>
  );
}

/** The count lands on the moment's second beat, after the check. */
function LessonsReadout() {
  const t = useExtracted();
  const format = useFormatter();
  const phases = useRevealPhases();
  const total = phases.reduce((sum, phase) => sum + phase.lessonsTotal, 0);
  const done = phases.reduce((sum, phase) => sum + phase.lessonsDone, 0);

  if (total === 0) {
    return null;
  }

  return (
    <Readout
      label={
        done > 0
          ? t(
              "{count, plural, one {lesson, {done, number} done} other {lessons, {done, number} done}}",
              { count: total, done },
            )
          : t("{count, plural, one {lesson} other {lessons}}", { count: total })
      }
    >
      <CountUp delayMs={BEAT_MS} format={(value) => format.number(value)} value={total} />
    </Readout>
  );
}

/** The month reads first and big, its year small, in the locale's order. */
function MonthYear({ isoDate }: { isoDate: string }) {
  const locale = useAppLocale();

  const parts = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).formatToParts(isoDateToUtc(isoDate));

  return parts.map((part, index) =>
    part.type === "year" ? (
      // oxlint-disable-next-line react/no-array-index-key -- the parts are fixed for this date
      <span className="text-muted-foreground text-[0.8125rem] font-medium" key={index}>
        {part.value}
      </span>
    ) : (
      part.value
    ),
  );
}

/** A language plan without a date ends where its aim is, so it reads as the aim and when. */
function FinishReadout() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const today = useMountTime();
  const { goal, plan } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;

  if (targetDate) {
    const days = daysUntilIsoDate({ isoDate: targetDate, today });

    return (
      <Readout label={goal.kind === "exam" ? t("until the exam") : t("until your date")}>
        <BigQuantity>
          {targetDateEstimated
            ? t("{days, plural, one {About # day} other {About # days}}", { days })
            : t("{days, plural, one {# day} other {# days}}", { days })}
        </BigQuantity>
      </Readout>
    );
  }

  if (!plan.estimate.endDate) {
    return null;
  }

  const aim = getAimAhead(plan.languageAim);

  return aim ? (
    <Readout
      label={t({
        description:
          'Under the level a language plan reaches: when. {month} is a month and year, like "Nov 2027".',
        message: "by {month}",
        values: { month: formatDate(plan.estimate.endDate, "month") },
      })}
    >
      {aim}
    </Readout>
  ) : (
    <Readout label={t("estimated finish")}>
      <MonthYear isoDate={plan.estimate.endDate} />
    </Readout>
  );
}

export function RevealReadouts() {
  return (
    <div className="grid auto-cols-fr grid-flow-col border-y [&>*+*]:border-s">
      <TimeReadout />
      <LessonsReadout />
      <FinishReadout />
    </div>
  );
}
