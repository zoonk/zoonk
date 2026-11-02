"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted, useFormatter } from "next-intl";
import { GoalRing, type GoalRingTrack } from "../_components/goal-ring";
import { ListGroup, ListRowContent, ListRowLink, ListRowTitle } from "../_components/list-group";
import { SectionLabel } from "../_components/section-label";
import { DoneMark } from "../_components/status-mark";
import { isoDateToUtc } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "../plan/plan-context";
import { usePaceFixText } from "../plan/plan-notice";
import { type PlanStatus, usePlanStatusText } from "../plan/plan-status-label";

type PlanDay = PlanView["week"]["days"][number];

const WEEK_TITLE_ID = "pace-week-title";

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
  const format = useFormatter();
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

      <ol className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const date = isoDateToUtc(day.date);

          return (
            <li className="flex flex-col items-center gap-1.5 py-1" key={day.date}>
              <span
                aria-hidden="true"
                className="text-muted-foreground font-mono text-[0.6875rem] font-medium uppercase"
              >
                {format.dateTime(date, { timeZone: "UTC", weekday: "narrow" })}
              </span>
              <GoalRing share={getDayShare(day)} track={DAY_TRACK[day.state]}>
                {day.state === "done" && <DoneMark />}
              </GoalRing>
              <span className="sr-only">
                {t("{day}: {status}", {
                  day: format.dateTime(date, { timeZone: "UTC", weekday: "long" }),
                  status: dayStatus(day),
                })}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function usePaceNumber({ paused, status }: { paused: boolean; status: PlanStatus }) {
  const t = useExtracted();
  const statusText = usePlanStatusText();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();

  if (status.kind === "finished") {
    return { detail: null, label: t("Pace"), value: t("Finished") };
  }

  if (status.kind === "pastDate") {
    return {
      detail: t("{count, plural, one {# lesson left} other {# lessons left}}", {
        count: status.lessons,
      }),
      label: t("Pace"),
      value: t("Past date"),
    };
  }

  if (status.kind === "challengesLeft") {
    return { detail: statusText(status), label: t("Pace"), value: t("Challenges") };
  }

  if (paused) {
    return { detail: t("Nothing is planned"), label: t("Pace"), value: t("Paused") };
  }

  switch (status.kind) {
    case "ahead":
      return { detail: statusText(status), label: t("Pace"), value: t("Ahead") };
    case "behind":
      return { detail: statusText(status), label: t("Pace"), value: t("Behind") };
    case "needsAdjusting":
      return { detail: statusText(status), label: t("Pace"), value: t("Too tight") };
    case "onTrack":
      return {
        detail: t("{time} a day", { time: formatDuration(plan.schedule.dailyMinutes) }),
        label: t("Pace"),
        value: t("On pace"),
      };
    default:
      return status satisfies never;
  }
}

export function PaceDetails({
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
  const statusText = usePlanStatusText();
  const planFix = usePaceFixText();

  const resting =
    paused &&
    status.kind !== "finished" &&
    status.kind !== "pastDate" &&
    status.kind !== "challengesLeft";

  const fix = resting ? null : planFix;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">{resting ? t("Paused") : statusText(status)}</p>
        {resting && (
          <p className="text-muted-foreground text-sm">
            {t("Nothing is planned until you resume it.")}
          </p>
        )}
        {fix && <p className="text-muted-foreground text-sm">{fix.text}</p>}
        {fix?.adjust && (
          <Button className="mt-1 self-start" onClick={onAdjust} size="sm" variant="outline">
            {t("Adjust plan")}
          </Button>
        )}
      </div>

      <PlanWeek />

      {logbookHref && (
        <ListGroup>
          <ListRowLink href={logbookHref}>
            <ListRowContent>
              <ListRowTitle>{t("Last week's recap")}</ListRowTitle>
            </ListRowContent>
          </ListRowLink>
        </ListGroup>
      )}
    </div>
  );
}
