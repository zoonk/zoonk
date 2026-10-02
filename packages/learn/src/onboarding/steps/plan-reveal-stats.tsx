"use client";

import { useExtracted, useFormatter } from "next-intl";
import { StatTile, StatTileLabel, StatTileValue } from "../../_components/stat-tile";
import { daysUntilIsoDate, useFormatIsoDate } from "../../_utils/iso-date";
import { usePlanScreen } from "../../plan/plan-context";

type Stat = { label: string; value: string };

/** How long until the goal, or when it's done at this pace, or its phases before an estimate. */
function useFirstStat(): Stat {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();
  const { targetDate } = plan.schedule;
  const { endDate } = plan.estimate;

  if (targetDate) {
    const days = daysUntilIsoDate({ isoDate: targetDate, today: new Date() });

    return {
      label: t("{days, plural, one {day until the goal} other {days until the goal}}", { days }),
      value: format.number(days),
    };
  }

  // An estimate is a month, not a day: "Sep 2028" also fits the tile beside the other numbers.
  if (endDate) {
    return { label: t("done around"), value: formatDate(endDate, "monthShort") };
  }

  // Without a date or an estimate yet, the plan's shape is the honest first number.
  const count = plan.phases.length;

  return {
    label: t("{count, plural, one {phase} other {phases}}", { count }),
    value: format.number(count),
  };
}

/**
 * The plan in three numbers, each a big figure over what it counts, so they fit side by side in
 * every language: how long until the goal (or when it's done at this pace, or its phases while
 * there's no estimate yet), the minutes a day and the study days a week.
 */
export function PlanRevealStats() {
  const t = useExtracted();
  const format = useFormatter();
  const { plan } = usePlanScreen();
  const { dailyMinutes, studyDays } = plan.schedule;
  const first = useFirstStat();

  const stats: Stat[] = [
    first,
    {
      label: t("{minutes, plural, one {minute a day} other {minutes a day}}", {
        minutes: dailyMinutes,
      }),
      value: format.number(dailyMinutes),
    },
    {
      label: t("{days, plural, one {day a week} other {days a week}}", { days: studyDays }),
      value: format.number(studyDays),
    },
  ];

  return (
    <ul aria-label={t("Your plan in numbers")} className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <li className="flex" key={stat.label}>
          <StatTile className="flex-1">
            <StatTileValue className="text-2xl">{stat.value}</StatTileValue>
            <StatTileLabel className="text-pretty">{stat.label}</StatTileLabel>
          </StatTile>
        </li>
      ))}
    </ul>
  );
}
