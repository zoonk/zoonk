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

/** A plan item the learner is through: studied, or skipped because they showed they know it. */
function isDone(item: PlanDay["items"][number]): boolean {
  return item.status === "done" || item.status === "testedOut";
}

/** How much of a day's plan is done, as its ring's arc. */
function getDayShare(day: PlanDay): number {
  if (day.state === "done") {
    return 1;
  }

  return day.items.length > 0
    ? day.items.filter((item) => isDone(item)).length / day.items.length
    : 0;
}

/** A day's track: today darker, a study day missed dashed (never red), a rest day faint. */
const DAY_TRACK: Record<PlanDay["state"], GoalRingTrack> = {
  done: "default",
  missed: "missed",
  rest: "rest",
  today: "today",
  upcoming: "default",
};

/** What a day of the week is, for screen readers: a day ahead is never "not studied". */
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

/** Actual time studied this week against the same shared budget Today shows. */
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

/** The plan's week as a row of rings, each filled by how much of its day's plan is done. */
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

/**
 * The pace as the Plan's number shows it: a word or two, its count under it ("Behind", "3 lessons to
 * catch up"). A paused goal has no pace to keep; a plan with every lesson and challenge done is
 * "Finished", never "13 days ahead" beside "You finished your plan"; one whose date came with
 * lessons left is "Past date" with what's left; one whose lessons are all done is "Challenges"
 * with how many are left, beside its 100%, never "Finished" beside "0 of 4 phases done". A pause
 * changes none of those.
 */
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

/**
 * "Your pace": how the learner keeps up with their plan. Their pace in a few words, this week's
 * days as rings with the time of what's done, the small fix when they're behind (or adjusting the
 * plan, when it no longer fits, or that the date came with lessons left), and last week's recap.
 * A paused goal has no pace to keep, as its number says: nothing to catch up on until it's resumed.
 * A finished plan still says so.
 */
export function PaceDetails({
  logbookHref,
  onAdjust,
  paused = false,
  status,
}: {
  /** The week's recap; null on a host without it. */
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
