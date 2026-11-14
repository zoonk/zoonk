import { getAppLocale } from "@/i18n/locale";
import { type EnergyDay } from "@zoonk/core/progress/energy";
import { type ChartPointDetail } from "@zoonk/ui/components/chart-inspector";
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import { getProgressDayFormatter } from "../_components/progress-insight-date-label";
import { StatsCalendar } from "../_components/stats-calendar";
import { getEnergyCalendarIntensity } from "./_utils/energy-calendar-intensity";

const ENERGY_HISTORY_TITLE_ID = "energy-history-title";

/** Softened: most days sit in the upper steps, and at full strength the calendar was the loudest thing on the page. */
const ENERGY_INTENSITY_CLASSES = [
  "bg-surface-3",
  "bg-energy/15",
  "bg-energy/30",
  "bg-energy/45",
  "bg-energy/60",
  "bg-energy/80",
] as const;

export async function EnergyChart({ days }: { days: EnergyDay[] }) {
  const [t, format, locale] = await Promise.all([getExtracted(), getFormatter(), getAppLocale()]);
  const formatDay = getProgressDayFormatter({ locale, newest: days.at(-1)?.date });

  const details = days.map((day): ChartPointDetail => [
    formatDay(day.date),
    day.energy === null
      ? t({
          description:
            "A calendar day's value, shown in a small tooltip under the day's date, for a day without an Energy value.",
          message: "No Energy recorded",
        })
      : t({
          description:
            "A calendar day's value, shown in a small tooltip under the day's date: the buddy's Energy that day, such as “72% Energy”.",
          message: "{percentage} Energy",
          values: { percentage: formatMetricPercent({ format, value: day.energy }) },
        }),
  ]);

  const calendarDays = days.map((day) => ({
    date: day.date,
    hasValue: day.energy !== null,
    intensityClass:
      ENERGY_INTENSITY_CLASSES.at(getEnergyCalendarIntensity(day.energy)) ??
      ENERGY_INTENSITY_CLASSES[0],
  }));

  return (
    <StatsCalendar
      days={calendarDays}
      details={details}
      gridLabel={t("Energy by day")}
      legend={{
        classes: ENERGY_INTENSITY_CLASSES,
        high: t("High"),
        label: t("Energy intensity from low to high"),
        low: t("Low"),
      }}
      titleId={ENERGY_HISTORY_TITLE_ID}
    />
  );
}
