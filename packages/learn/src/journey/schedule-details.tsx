"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { isoDateToUtc } from "@zoonk/utils/date-format";
import { useExtracted } from "next-intl";
import { ListGroup, ListRowContent, ListRowLink, ListRowTitle } from "../_components/list-group";
import { SectionLabel } from "../_components/section-label";
import {
  WEEK_DAY_CLASS,
  WEEK_ROW_CLASS,
  WeekDayLetter,
  WeekDayRing,
  useWeekDayStatus,
} from "../_components/week-row";
import { useFormatWeekday } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { usePlanStateLine } from "../plan/plan-notice";
import { DailyTimeValue } from "../plan/plan-properties";
import { type PlanStatus, usePlanStatusText } from "../plan/plan-status-label";
import { showsPausedSchedule } from "./schedule-state";

const WEEK_TITLE_ID = "schedule-week-title";

function useWeekTime(): string | null {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { studiedMinutes, targetMinutes } = usePlanScreen().plan.weekTime;

  if (targetMinutes === 0) {
    return null;
  }

  return t("{done} of {planned}", {
    done: formatDuration(studiedMinutes),
    planned: formatDuration(targetMinutes),
  });
}

/** Drawn with Today's rings, so a day reads the same on both screens. */
function PlanWeek() {
  const t = useExtracted();
  const formatWeekday = useFormatWeekday();
  const { goal, plan } = usePlanScreen();
  const time = useWeekTime();
  const days = plan.week.days.map((day) => ({ ...day.study, date: isoDateToUtc(day.study.date) }));
  const localDate = days.find((day) => day.isToday)?.date ?? isoDateToUtc(plan.week.startDate);
  const dayStatus = useWeekDayStatus({ examGoal: goal.kind === "exam", localDate });

  return (
    <section aria-labelledby={WEEK_TITLE_ID} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel id={WEEK_TITLE_ID}>{t("This week")}</SectionLabel>
        {time && (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">{time}</span>
        )}
      </div>

      <ol className={WEEK_ROW_CLASS}>
        {days.map((day) => (
          <li className={cn(WEEK_DAY_CLASS, "py-1")} key={day.date.toISOString()}>
            <WeekDayRing day={day} localDate={localDate} />
            <WeekDayLetter date={day.date} isToday={day.isToday} />
            <span className="sr-only">
              {t("{day}: {status}", { day: formatWeekday(day.date), status: dayStatus(day) })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "Paused", the schedule's state while nothing is planned, and what that means. */
function usePausedText() {
  const t = useExtracted();

  return {
    detail: t("Nothing is planned until you resume it."),
    value: t({
      description: "The plan's schedule while the learner has paused the goal.",
      message: "Paused",
    }),
  };
}

export function useScheduleNumber({
  paused,
  status,
  timeShownBeside,
}: {
  paused: boolean;
  status: PlanStatus;
  timeShownBeside: boolean;
}) {
  const t = useExtracted();
  const statusText = usePlanStatusText();
  const pausedText = usePausedText();
  const label = t("Schedule");

  if (showsPausedSchedule({ paused, status })) {
    return { detail: pausedText.detail, label, value: pausedText.value };
  }

  if (status.kind === "pastDate") {
    return {
      detail: t("{count, plural, one {# lesson left} other {# lessons left}}", {
        count: status.lessons,
      }),
      label,
      value: statusText(status),
    };
  }

  if (status.kind === "finished" || status.kind === "challengesLeft") {
    return { detail: null, label, value: statusText(status) };
  }

  return {
    detail: status.kind === "needsAdjusting" || timeShownBeside ? null : <DailyTimeValue perDay />,
    label,
    value: statusText(status),
  };
}

export function ScheduleDetails({
  logbookHref,
  onAdjust,
  paused = false,
  status,
}: {
  logbookHref: string | null;
  onAdjust: () => void;
  paused?: boolean;
  status: PlanStatus;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const statusText = usePlanStatusText();
  const pausedText = usePausedText();
  const stateLine = usePlanStateLine();
  const showsPaused = showsPausedSchedule({ paused, status });
  const line = showsPaused ? null : stateLine;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">{showsPaused ? pausedText.value : statusText(status)}</p>
        {!showsPaused && status.kind === "onTrack" && (
          <p className="text-muted-foreground text-sm">
            <DailyTimeValue perDay />
          </p>
        )}
        {showsPaused && <p className="text-muted-foreground text-sm">{pausedText.detail}</p>}
        {line && <p className="text-muted-foreground text-sm">{line.text}</p>}
        {(line?.adjust || status.kind === "pastDate") && (
          <Button className="mt-1 self-start" onClick={onAdjust} size="sm" variant="outline">
            {t("Adjust plan")}
          </Button>
        )}
        {line?.today && (
          <LearnLink
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-1 self-start")}
            href={routes.today}
          >
            {t("Today")}
          </LearnLink>
        )}
      </div>

      <PlanWeek />

      {logbookHref && (
        <ListGroup>
          <ListRowLink href={logbookHref}>
            <ListRowContent>
              <ListRowTitle>{t("Weekly summary")}</ListRowTitle>
            </ListRowContent>
          </ListRowLink>
        </ListGroup>
      )}
    </div>
  );
}
