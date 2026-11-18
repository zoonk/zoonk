"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { isoDateToUtc } from "@zoonk/utils/date-format";
import { useExtracted } from "next-intl";
import { GoalRing, type GoalRingTrack } from "../_components/goal-ring";
import { ListGroup, ListRowContent, ListRowLink, ListRowTitle } from "../_components/list-group";
import { SectionLabel } from "../_components/section-label";
import { DoneMark } from "../_components/status-mark";
import { WEEK_DAY_CLASS, WEEK_ROW_CLASS, WeekDayLetter } from "../_components/week-row";
import { useFormatWeekday } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { usePlanStateLine } from "../plan/plan-notice";
import { DailyTimeValue } from "../plan/plan-properties";
import { type PlanStatus, usePlanStatusText } from "../plan/plan-status-label";
import { useStudyDaysText } from "../plan/use-study-days-text";
import { showsResumeSchedule } from "./schedule-state";

type PlanDay = PlanView["week"]["days"][number];

const WEEK_TITLE_ID = "schedule-week-title";

function isDone(item: PlanDay["items"][number]): boolean {
  return item.status === "done" || item.status === "testedOut";
}

function getDayShare(day: PlanDay): number {
  if (day.state === "done") {
    return 1;
  }

  return day.items.length > 0
    ? day.items.filter((item) => isDone(item)).length / day.items.length
    : 0;
}

const DAY_TRACK: Record<PlanDay["state"], GoalRingTrack> = {
  done: "default",
  missed: "missed",
  rest: "rest",
  today: "today",
  upcoming: "default",
};

function useDayStatus() {
  const t = useExtracted();

  return (day: PlanDay): string => {
    switch (day.state) {
      case "done":
        return t("done");
      case "missed":
        return t("not studied");
      case "rest":
        return t("rest day");
      case "today":
        return t("today");
      case "upcoming":
        return t("planned");
      default:
        return day.state satisfies never;
    }
  };
}

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

function PlanWeek() {
  const t = useExtracted();
  const formatWeekday = useFormatWeekday();
  const dayStatus = useDayStatus();
  const { plan } = usePlanScreen();
  const { days } = plan.week;
  const time = useWeekTime();

  return (
    <section aria-labelledby={WEEK_TITLE_ID} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel id={WEEK_TITLE_ID}>{t("This week")}</SectionLabel>
        {time && (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">{time}</span>
        )}
      </div>

      <ol className={WEEK_ROW_CLASS}>
        {days.map((day) => {
          const date = isoDateToUtc(day.date);

          return (
            <li className={cn(WEEK_DAY_CLASS, "py-1")} key={day.date}>
              <GoalRing share={getDayShare(day)} track={DAY_TRACK[day.state]}>
                {day.state === "done" && <DoneMark />}
              </GoalRing>
              <WeekDayLetter date={date} isToday={day.state === "today"} />
              <span className="sr-only">
                {t("{day}: {status}", { day: formatWeekday(date), status: dayStatus(day) })}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function useResumeScheduleDays() {
  const studyDays = useStudyDaysText();
  const { weekdayMinutes } = usePlanScreen().plan.schedule;
  return studyDays(weekdayMinutes);
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
  const scheduleDays = useResumeScheduleDays();
  const formatDuration = useFormatDuration();
  const { dailyMinutes } = usePlanScreen().plan.schedule;
  const label = t("Schedule");

  if (showsResumeSchedule({ paused, status })) {
    return { detail: scheduleDays, label, value: <DailyTimeValue readout /> };
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
    detail:
      status.kind === "needsAdjusting" || timeShownBeside
        ? null
        : t("About {time} a day", { time: formatDuration(dailyMinutes) }),
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
  const stateLine = usePlanStateLine();

  const scheduleDays = useResumeScheduleDays();
  const formatDuration = useFormatDuration();
  const { dailyMinutes } = usePlanScreen().plan.schedule;
  const resume = showsResumeSchedule({ paused, status });
  const line = resume ? null : stateLine;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">{resume ? <DailyTimeValue readout /> : statusText(status)}</p>
        {resume && <p className="text-muted-foreground text-sm">{scheduleDays}</p>}
        {!resume && status.kind === "onTrack" && (
          <p className="text-muted-foreground text-sm">
            {t("About {time} a day", { time: formatDuration(dailyMinutes) })}
          </p>
        )}
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
            {t("Go to Today")}
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
