"use client";

import { type PlanDayView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, TrophyIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";
import { useDayStateLabels } from "./use-day-state-labels";
import { findWeekCheckpoint, useItemTitle } from "./use-item-title";

function DayDot({ day }: { day: PlanDayView }) {
  const checkpoint = findWeekCheckpoint(day.items);

  if (day.state === "done") {
    return (
      <span className="bg-fun-accent-lime flex size-10 items-center justify-center rounded-full text-(--fun-inv-fg)">
        <CheckIcon aria-hidden="true" className="size-5" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-full",
        day.state === "today" ? "ring-fun-accent-lime ring-2" : "bg-fun-soft",
        day.state === "rest" && "opacity-60",
      )}
    >
      {checkpoint ? (
        <TrophyIcon aria-hidden="true" className="text-fun-gold size-4" />
      ) : (
        day.state === "today" && <span className="bg-fun-accent-lime size-3 rounded-full" />
      )}
    </span>
  );
}

/** This week as seven stops, the week's challenge marked with a trophy. */
export function FunWeek() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const itemTitle = useItemTitle();
  const dayStates = useDayStateLabels();
  const { plan } = usePlanScreen();
  const { days } = plan.week;
  const done = days.filter((day) => day.state === "done").length;

  return (
    <section
      aria-labelledby="fun-week-title"
      className="fun-glass flex flex-col gap-4 rounded-3xl p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-fun-display text-sm font-semibold" id="fun-week-title">
          {t("This week")}
        </h2>
        <span className="text-fun-fg2 text-xs">
          {t("{count, plural, one {# day done} other {# days done}}", { count: done })}
        </span>
      </div>

      <ol className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <li
            aria-label={[
              formatDate(day.date, "weekday"),
              dayStates[day.state],
              ...day.items.map((item) => itemTitle(item)),
            ]
              .filter(Boolean)
              .join(", ")}
            className="flex flex-col items-center gap-1.5"
            data-state={day.state}
            key={day.date}
          >
            <DayDot day={day} />
            <span
              aria-hidden="true"
              className={cn(
                "text-xs capitalize",
                day.state === "today" ? "text-fun-accent-lime font-bold" : "text-fun-fg2",
              )}
            >
              {formatDate(day.date, "weekdayShort")}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
