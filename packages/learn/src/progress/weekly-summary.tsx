"use client";

import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { StatTile, StatTileLabel, StatTileValue } from "../_components/stat-tile";
import { useProgressScreen } from "./progress-context";

/** Only a gain on last week shows: a lighter week is never held against the learner. */
function Delta({ value }: { value: number }) {
  const t = useExtracted();

  if (value <= 0) {
    return null;
  }

  return (
    <span className="text-success in-data-[mode=fun]:text-fun-accent-lime text-xs tabular-nums">
      {t("+{value, number} vs last week", { value })}
    </span>
  );
}

/** The week against the learner's own last week, and the skill that moved the most. */
export function WeeklySummary() {
  const t = useExtracted();
  const { progress } = useProgressScreen();
  const { week } = progress;

  if (!week) {
    return null;
  }

  const stats = [
    {
      delta: week.comparison.minutes,
      label: t("minutes"),
      value: t("{minutes, number}", { minutes: week.minutes }),
    },
    {
      delta: week.comparison.days,
      label: t("days"),
      value: t("{days, number}", { days: week.days }),
    },
    {
      delta: week.comparison.questions,
      label: t("questions"),
      value: t("{questions, number}", { questions: week.questions }),
    },
  ];

  return (
    <section aria-labelledby="weekly-summary-title" className="flex flex-col gap-3">
      <SectionLabel id="weekly-summary-title">{t("This week")}</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <StatTile key={stat.label}>
            <StatTileValue>{stat.value}</StatTileValue>
            <StatTileLabel>{stat.label}</StatTileLabel>
            <Delta value={stat.delta} />
          </StatTile>
        ))}
      </div>
      {week.turnaround && (
        <p className="text-sm">
          {week.turnaround.reason === "gold"
            ? t("{skill} turned gold: you remembered it on three different days.", {
                skill: week.turnaround.name,
              })
            : t("Biggest turnaround: {skill}.", { skill: week.turnaround.name })}
        </p>
      )}
    </section>
  );
}
