"use client";

import { type PlanDayView, type PlanItemView } from "@zoonk/core/plans/view-contract";
import { Badge } from "@zoonk/ui/components/badge";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  CirclePlayIcon,
  FlagIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";
import { useDayStateLabels } from "./use-day-state-labels";
import { findWeekCheckpoint, useItemTitle } from "./use-item-title";

const DAY_ICONS = {
  done: CircleCheckIcon,
  missed: CircleDashedIcon,
  rest: CircleIcon,
  today: CirclePlayIcon,
  upcoming: CircleIcon,
} as const;

function PlusBadge() {
  const t = useExtracted();

  return (
    <Badge className="shrink-0" variant="outline">
      {t("Plus")}
    </Badge>
  );
}

function DayItems({ day }: { day: PlanDayView }) {
  const t = useExtracted();
  const itemTitle = useItemTitle();

  if (day.state === "rest") {
    return <span className="text-muted-foreground text-sm">{t("Rest")}</span>;
  }

  // A study day with nothing scheduled from the plan: the session fills it with reviews and practice.
  if (day.items.length === 0) {
    return <span className="text-muted-foreground text-sm">{t("Review and practice")}</span>;
  }

  return (
    <span className="min-w-0 text-sm">{day.items.map((item) => itemTitle(item)).join(" · ")}</span>
  );
}

function hasCheckpoint(items: readonly PlanItemView[]) {
  return findWeekCheckpoint(items) !== null;
}

function PlanWeekDay({ day }: { day: PlanDayView }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const dayStatus = useDayStateLabels()[day.state];
  const Icon = hasCheckpoint(day.items) ? FlagIcon : DAY_ICONS[day.state];
  const needsPlus = day.items.some((item) => item.requiresPlus);

  return (
    <li
      aria-current={day.state === "today" ? "date" : undefined}
      // Day, icon and time stay on the first line when a day's lessons take two.
      className={cn(
        "flex items-start gap-3 rounded-xl px-2 py-3",
        day.state === "today" && "bg-muted font-medium",
      )}
      data-state={day.state}
    >
      <span className="text-muted-foreground w-10 shrink-0 text-sm capitalize">
        {formatDate(day.date, "weekdayShort")}
      </span>
      <LineMarker aria-hidden="true" className="text-sm">
        <Icon
          className={cn(
            "size-4",
            day.state === "done" ? "text-success" : "text-muted-foreground",
            day.state === "today" && "text-foreground",
          )}
        />
      </LineMarker>
      {dayStatus && day.state !== "today" && <span className="sr-only">{dayStatus}</span>}
      <DayItems day={day} />
      <LineMarker className="ml-auto gap-2 text-sm">
        {needsPlus && <PlusBadge />}
        {day.state === "today" && (
          <span className="text-muted-foreground text-xs">{t("today")}</span>
        )}
        {day.minutes > 0 && day.state !== "today" && day.state !== "rest" && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("{minutes, number} min", { minutes: day.minutes })}
          </span>
        )}
      </LineMarker>
    </li>
  );
}

/** This week day by day: each day's focus and time, the week's checkpoint flagged. */
export function PlanWeek() {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const { days } = plan.week;
  const studyDays = days.filter((day) => day.state !== "rest").length;
  const doneDays = days.filter((day) => day.state === "done").length;

  return (
    <section aria-labelledby="plan-week-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-2">
        <SectionLabel id="plan-week-title">{t("This week")}</SectionLabel>
        <span className="text-muted-foreground text-xs">
          {t("{total, plural, one {{done, number} of # day} other {{done, number} of # days}}", {
            done: doneDays,
            total: studyDays,
          })}
        </span>
      </div>
      <ol className="flex flex-col">
        {days.map((day) => (
          <PlanWeekDay day={day} key={day.date} />
        ))}
      </ol>
    </section>
  );
}

/** Today's part of the plan, one line per stop. */
export function PlanToday() {
  const t = useExtracted();
  const itemTitle = useItemTitle();
  const { plan } = usePlanScreen();
  const today = plan.week.days.find((day) => day.state === "today");
  const items = today?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground px-2 text-sm">
        {t("Nothing planned for today. Rest well.")}
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {items.map((item) => (
        <li className="flex items-start gap-3 px-2 py-3" data-status={item.status} key={item.id}>
          <LineMarker aria-hidden="true" className="text-sm">
            {item.status === "todo" ? (
              <CircleIcon className="text-muted-foreground size-4" />
            ) : (
              <CircleCheckIcon className="text-success size-4" />
            )}
          </LineMarker>
          <span className="min-w-0 flex-1 text-sm">{itemTitle(item)}</span>
          <LineMarker className="gap-2 text-sm">
            {item.requiresPlus && <PlusBadge />}
            {item.minutes !== null && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("{minutes, number} min", { minutes: item.minutes })}
              </span>
            )}
          </LineMarker>
        </li>
      ))}
    </ol>
  );
}
